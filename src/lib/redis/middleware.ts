import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RateLimitPresets, type RateLimitConfig } from '@/lib/redis/rate-limit';

/**
 * Rate Limiting Middleware
 * 
 * Wrapper functions to apply rate limiting to API routes
 */

export interface RateLimitOptions {
    limit?: number;
    window?: number;
    identifier?: (req: NextRequest) => string | Promise<string>;
    onLimitExceeded?: (req: NextRequest) => NextResponse;
}

/**
 * Create a rate-limited API route handler
 * 
 * @param handler - Original route handler
 * @param options - Rate limit configuration
 * @returns Wrapped handler with rate limiting
 */
export function withRateLimit(
    handler: (req: NextRequest) => Promise<NextResponse> | NextResponse,
    options: RateLimitOptions = {}
) {
    return async (req: NextRequest): Promise<NextResponse> => {
        const {
            limit = RateLimitPresets.API_DEFAULT.limit,
            window = RateLimitPresets.API_DEFAULT.window,
            identifier = defaultIdentifier,
            onLimitExceeded = defaultLimitExceededHandler,
        } = options;

        // Get identifier (userId or IP)
        const id = await identifier(req);

        // Extract endpoint from URL
        const endpoint = new URL(req.url).pathname;

        // Check rate limit
        const result = await checkRateLimit({
            limit,
            window,
            identifier: id,
            endpoint,
        });

        // If rate limit exceeded, return error response
        if (!result.success) {
            return onLimitExceeded(req);
        }

        // Add rate limit headers to response
        const response = await handler(req);

        response.headers.set('X-RateLimit-Limit', result.limit.toString());
        response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
        response.headers.set('X-RateLimit-Reset', result.reset.toString());

        return response;
    };
}

/**
 * Default identifier function
 * Uses user ID from auth or falls back to IP address
 */
async function defaultIdentifier(req: NextRequest): Promise<string> {
    // Try to get user ID from auth header or cookie
    // For now, use IP address from headers as fallback
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const ip = forwarded ? forwarded.split(',')[0] : (realIp || 'unknown');

    return ip;
}

/**
 * Default rate limit exceeded handler
 */
function defaultLimitExceededHandler(req: NextRequest): NextResponse {
    return NextResponse.json(
        {
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
        },
        {
            status: 429,
            headers: {
                'Retry-After': '60',
            },
        }
    );
}

/**
 * Preset rate limit middleware for common use cases
 */
export const RateLimitMiddleware = {
    /**
     * For AI analysis endpoints
     * 10 requests per hour per user
     */
    aiAnalysis: (handler: (req: NextRequest) => Promise<NextResponse> | NextResponse) =>
        withRateLimit(handler, {
            limit: RateLimitPresets.AI_ANALYSIS.limit,
            window: RateLimitPresets.AI_ANALYSIS.window,
            onLimitExceeded: () =>
                NextResponse.json(
                    {
                        error: 'AI Analysis rate limit exceeded',
                        message: 'You have reached the maximum number of AI analyses per hour. Please try again later.',
                    },
                    { status: 429, headers: { 'Retry-After': '3600' } }
                ),
        }),

    /**
     * For file upload endpoints
     * 20 uploads per hour per user
     */
    fileUpload: (handler: (req: NextRequest) => Promise<NextResponse> | NextResponse) =>
        withRateLimit(handler, {
            limit: RateLimitPresets.FILE_UPLOAD.limit,
            window: RateLimitPresets.FILE_UPLOAD.window,
            onLimitExceeded: () =>
                NextResponse.json(
                    {
                        error: 'Upload rate limit exceeded',
                        message: 'You have uploaded too many files. Please try again later.',
                    },
                    { status: 429, headers: { 'Retry-After': '3600' } }
                ),
        }),

    /**
     * Strict rate limiting for sensitive operations
     * 5 requests per minute
     */
    strict: (handler: (req: NextRequest) => Promise<NextResponse> | NextResponse) =>
        withRateLimit(handler, {
            limit: RateLimitPresets.STRICT.limit,
            window: RateLimitPresets.STRICT.window,
        }),

    /**
     * Generous rate limiting for read operations
     * 1000 requests per hour
     */
    generous: (handler: (req: NextRequest) => Promise<NextResponse> | NextResponse) =>
        withRateLimit(handler, {
            limit: RateLimitPresets.GENEROUS.limit,
            window: RateLimitPresets.GENEROUS.window,
        }),
};
