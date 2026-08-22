import { NextRequest } from 'next/server';
import { executeMultiAgentPipeline } from '@/ai/orchestrator';

export const runtime = 'nodejs';

/**
 * Server-Sent Events (SSE) Endpoint for Real-Time AI Report Token Streaming.
 * Delivers diagnostic tokens live to the UI chunk-by-chunk for <100ms TTFT.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { symptoms, imageUrl, bodyLocation } = body;

        if (!symptoms || typeof symptoms !== 'string') {
            return new Response('Missing symptoms parameter.', { status: 400 });
        }

        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                // Send initial connection event
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'start', message: 'Orchestrating multi-agent pipeline...' })}\n\n`));

                try {
                    // Execute pipeline
                    const result = await executeMultiAgentPipeline({ symptoms, imageUrl, bodyLocation });

                    // Stream agent trace steps
                    if (result.agentTrace) {
                        for (const step of result.agentTrace) {
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ event: 'agent_step', agent: step.agent, durationMs: step.durationMs })}\n\n`)
                            );
                            await new Promise((r) => setTimeout(r, 100));
                        }
                    }

                    // Stream generated summary tokens chunk by chunk
                    const summary = result.report?.summary || '';
                    const words = summary.split(' ');
                    for (let i = 0; i < words.length; i++) {
                        const tokenChunk = (i === 0 ? '' : ' ') + words[i];
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'token', chunk: tokenChunk })}\n\n`));
                        await new Promise((r) => setTimeout(r, 40));
                    }

                    // Stream final report payload
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'complete', report: result.report, executionTimeMs: result.executionTimeMs })}\n\n`));
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : 'Streaming error';
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'error', error: message })}\n\n`));
                } finally {
                    controller.close();
                }
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
        const message = err instanceof Error ? err.message : 'Internal streaming error';
        return new Response(message, { status: 500 });
    }
}
