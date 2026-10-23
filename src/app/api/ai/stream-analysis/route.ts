import { NextRequest } from 'next/server';
import { executeMultiAgentPipeline } from '@/ai/orchestrator';
import { checkRateLimit, RateLimitPresets } from '@/lib/redis/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { AnalysisRequestSchema } from '@/ai/analysis-request';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * SSE endpoint for connection status and the completed, safety-checked report.
 * This is not provider token streaming: results are emitted after synthesis.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return new Response('Unauthorized', { status: 401 });
        }
        const body = AnalysisRequestSchema.safeParse(await request.json());
        if (!body.success) return Response.json({ error: 'Invalid analysis parameters.' }, { status: 400 });
        const { symptoms, imageUrl, bodyLocation, durationDays } = body.data;

        // Same pipeline cost as /api/ai/analyze — apply the same rate limit.
        const identifier = user.id;
        const rateLimitResult = await checkRateLimit({
            limit: RateLimitPresets.AI_ANALYSIS.limit,
            window: RateLimitPresets.AI_ANALYSIS.window,
            identifier,
            endpoint: '/api/ai/stream-analysis',
        });
        if (!rateLimitResult.success) {
            return new Response(rateLimitResult.unavailable ? 'Request protection is temporarily unavailable.' : 'Rate limit exceeded. Please try again later.', {
                status: rateLimitResult.unavailable ? 503 : 429,
                headers: { 'Retry-After': String(rateLimitResult.retryAfter ?? 3600) },
            });
        }

        const encoder = new TextEncoder();
        let cancelled = false;

        const stream = new ReadableStream({
            async start(controller) {
                const send = (data: Record<string, unknown>) => {
                    if (!cancelled && !request.signal.aborted) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                    }
                };
                // Send initial connection event
                send({ event: 'start', message: 'Orchestrating multi-agent pipeline...' });

                try {
                    // Execute pipeline
                    const result = await executeMultiAgentPipeline({ symptoms, imageUrl, bodyLocation, durationDays, userId: user.id });

                    // Stream agent trace steps
                    if (result.agentTrace) {
                        for (const step of result.agentTrace) {
                            send({ event: 'agent_step', agent: step.agent, durationMs: step.durationMs });
                        }
                    }

                    // Stream generated summary tokens chunk by chunk
                    const summary = result.report?.summary || '';
                    send({ event: 'token', chunk: summary });

                    // Stream final report payload
                    send({ event: 'complete', report: result.report, executionTimeMs: result.executionTimeMs });
                } catch (err: unknown) {
                    logger.error('ai.stream.failed', { error: String(err) });
                    send({ event: 'error', error: 'Analysis is unavailable. Please try again later.' });
                } finally {
                    if (!cancelled) controller.close();
                }
            },
            cancel() {
                cancelled = true;
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                Connection: 'keep-alive',
            },
        });
    } catch (err: unknown) {
        if (err instanceof SyntaxError) return new Response('Invalid JSON body.', { status: 400 });
        logger.error('ai.stream.request_failed', { error: String(err) });
        return new Response('Analysis is unavailable.', { status: 503 });
    }
}
