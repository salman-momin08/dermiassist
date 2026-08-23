import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RateLimitPresets } from '@/lib/redis/rate-limit';

/**
 * Benchmark eval endpoint.
 *
 * Runs the LLM-as-a-Judge suite against the REAL Python model engine
 * (FastAPI /api/v1/eval/run), which executes each case through Gemini/OpenAI and
 * reports true diagnostic accuracy plus explicit model-health status.
 *
 * If the Python engine is unreachable we return an honest 503 with
 * modelEngineAvailable=false rather than falling back to a fabricated result —
 * a down eval engine must be visible, not masked.
 */
export async function GET(request: NextRequest) {
    try {
        // Most expensive endpoint in the app; rate-limit strictly by IP.
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

        const provider = request.nextUrl.searchParams.get('provider') || 'openai';
        const fastApiUrl =
            process.env.PYTHON_AI_SERVICE_URL ||
            process.env.FASTAPI_SERVICE_URL ||
            'http://localhost:8000';

        try {
            const resp = await fetch(`${fastApiUrl}/api/v1/eval/run?provider=${encodeURIComponent(provider)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-internal-api-key': process.env.PYTHON_AI_SERVICE_API_KEY || '',
                },
                // The suite runs every benchmark case through a real model; allow time.
                signal: AbortSignal.timeout(120000),
            });

            if (!resp.ok) {
                const detail = await resp.text().catch(() => '');
                return NextResponse.json(
                    {
                        error: `Python eval engine returned HTTP ${resp.status}`,
                        detail,
                        modelEngineAvailable: false,
                    },
                    { status: 502 }
                );
            }

            const report = await resp.json();
            return NextResponse.json({ ...report, engine: 'FastAPI (Python)' });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return NextResponse.json(
                {
                    error: 'Python model engine is unavailable — benchmark evals cannot run. Start the FastAPI service to evaluate real model accuracy.',
                    detail: message,
                    modelEngineAvailable: false,
                },
                { status: 503 }
            );
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Evaluation harness error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
