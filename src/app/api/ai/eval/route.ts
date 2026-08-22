import { NextRequest, NextResponse } from 'next/server';
import { runAIEvalHarness } from '@/ai/eval/eval-harness';
import { checkRateLimit, RateLimitPresets } from '@/lib/redis/rate-limit';

export async function GET(request: NextRequest) {
    try {
        // This harness runs the full multi-agent pipeline across every benchmark
        // case per call — the most expensive single endpoint in the app — and
        // has no per-user identity, so rate-limit strictly by IP.
        const forwardedFor = request.headers.get('x-forwarded-for');
        const identifier = forwardedFor?.split(',')[0].trim() || 'unknown';
        const rateLimitResult = await checkRateLimit({
            limit: RateLimitPresets.STRICT.limit,
            window: RateLimitPresets.STRICT.window,
            identifier,
            endpoint: '/api/ai/eval',
        });
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please try again later.' },
                { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter ?? 60) } }
            );
        }

        const report = await runAIEvalHarness();
        return NextResponse.json(report);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Evaluation harness error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
