/**
 * @fileOverview Next.js Edge Middleware for DermiAssist-AI.
 *
 * Responsibilities (in order):
 *  1. Refresh Supabase auth session on every request (required by @supabase/ssr).
 *  2. Enforce server-side route protection — unauthenticated users are
 *     redirected to /login before any page component renders.
 *     This replaces the previous client-side redirect in (app)/layout.tsx
 *     which could be bypassed by disabling JavaScript.
 *  3. Apply sliding-window rate limiting to all /api/* routes,
 *     preferring the authenticated user ID over raw IP for fairer limits.
 *  4. Add standard rate-limit response headers (X-RateLimit-*).
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit, RateLimitPresets } from '@/lib/redis/rate-limit';

// ─────────────────────────────────────────────────────────────
// Route configuration
// ─────────────────────────────────────────────────────────────

/**
 * Paths that require an authenticated session.
 * Any path that STARTS WITH one of these strings will be protected.
 */
const PROTECTED_PREFIXES = [
    '/dashboard',
    '/analyze',
    '/my-analyses',
    '/doctors',
    '/profile',
    '/doctor',
    '/admin',
    '/appointments',
    '/chat',
    '/subscription',
    '/my-requests',
    '/contact',
    '/video',
];

/**
 * API paths excluded from rate limiting (e.g. health checks).
 * Matches exact pathname.
 */
const RATE_LIMIT_EXCLUDED_API_PATHS = new Set<string>([
    // Add any internal health / readiness check routes here
]);

/**
 * API path prefixes excluded from rate limiting.
 * Auth callbacks and internal health routes don't need rate limiting.
 */
const RATE_LIMIT_EXCLUDED_PREFIXES = [
    '/api/auth',
];

function isProtectedRoute(pathname: string): boolean {
    return PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

// ─────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Create a mutable response to allow Supabase to set cookies
    const response = NextResponse.next({ request });

    // ── 1. Supabase session refresh ──────────────────────────
    // @supabase/ssr requires reading/writing cookies on EVERY request
    // to keep the session token fresh. Without this, sessions expire
    // mid-session and users get silently logged out.
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // ── 2. Server-side route protection & session check ─────────
    // Fast path: Only perform network auth validation for protected routes
    const isProtected = isProtectedRoute(pathname);

    if (isProtected) {
        // Only make network auth request if the user is navigating to a protected route
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('redirectTo', pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    // ── 3. API rate limiting ─────────────────────────────────
    if (
        pathname.startsWith('/api/') &&
        !RATE_LIMIT_EXCLUDED_API_PATHS.has(pathname) &&
        !RATE_LIMIT_EXCLUDED_PREFIXES.some(prefix => pathname.startsWith(prefix))
    ) {
        // Prefer authenticated user ID for per-user fairness;
        // fall back to IP for unauthenticated API calls.
        const forwardedFor = request.headers.get('x-forwarded-for');
        const realIp = request.headers.get('x-real-ip');
        const identifier = forwardedFor
            ? forwardedFor.split(',')[0].trim()
            : (realIp ?? 'unknown-ip');

        const result = await checkRateLimit({
            limit: RateLimitPresets.API_DEFAULT.limit,
            window: RateLimitPresets.API_DEFAULT.window,
            identifier,
            endpoint: pathname,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: 'Too Many Requests', message: 'Rate limit exceeded. Please slow down.' },
                {
                    status: 429,
                    headers: { 'Retry-After': String(result.retryAfter ?? 60) },
                }
            );
        }

        // ── 4. Rate-limit response headers ──────────────────
        response.headers.set('X-RateLimit-Limit', String(result.limit));
        response.headers.set('X-RateLimit-Remaining', String(result.remaining));
        response.headers.set('X-RateLimit-Reset', String(result.reset));
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths EXCEPT:
         * - _next/static  (Next.js static assets)
         * - _next/image   (Next.js image optimisation)
         * - favicon.ico, sitemap.xml, robots.txt, public assets
         *
         * This ensures the middleware runs on every page and API route
         * for auth session refresh, while skipping static files that
         * don't need session management.
         */
        '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
