import { NextRequest, NextResponse } from 'next/server';
import { executeMultiAgentPipeline } from '@/ai/orchestrator';
import { checkRateLimit, RateLimitPresets } from '@/lib/redis/rate-limit';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { symptoms, imageUrl, bodyLocation, durationDays, userId, provider } = body;

        if (!symptoms || typeof symptoms !== 'string') {
            return NextResponse.json(
                { error: 'Missing or invalid symptoms parameter.' },
                { status: 400 }
            );
        }

        // This endpoint runs the full multi-agent pipeline (or an OpenAI call) —
        // rate-limit it the same way as the other AI-invoking flows.
        const forwardedFor = request.headers.get('x-forwarded-for');
        const identifier = userId || forwardedFor?.split(',')[0].trim() || 'unknown';
        const rateLimitResult = await checkRateLimit({
            limit: RateLimitPresets.AI_ANALYSIS.limit,
            window: RateLimitPresets.AI_ANALYSIS.window,
            identifier,
            endpoint: '/api/ai/analyze',
        });
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please try again later.' },
                { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter ?? 3600) } }
            );
        }

        // 1. Primary engine: FastAPI Python Microservice — REAL Gemini/OpenAI
        //    inference with honest failure (no fabricated diagnosis). Both
        //    providers route here so model health is reported consistently.
        try {
            const fastApiUrl = process.env.PYTHON_AI_SERVICE_URL || process.env.FASTAPI_SERVICE_URL || 'http://localhost:8000';
            const fastApiResponse = await fetch(`${fastApiUrl}/api/v1/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-internal-api-key': process.env.PYTHON_AI_SERVICE_API_KEY || '',
                },
                body: JSON.stringify({
                    symptoms,
                    image_url: imageUrl,
                    body_location: bodyLocation,
                    // Detection/analysis defaults to OpenAI (dedicated diagnostic-reasoning
                    // engine); Gemini is only used for this path if explicitly requested.
                    provider: provider === 'gemini' ? 'gemini' : 'openai',
                }),
                // Real model calls take time; allow the pipeline to complete.
                signal: AbortSignal.timeout(30000),
            });

            if (fastApiResponse.ok) {
                const fastApiData = await fastApiResponse.json();
                return NextResponse.json({
                    ...fastApiData,
                    microservice: 'FastAPI (Python)',
                });
            }

            // Primary engine reachable but returned a non-OK status — surface it in
            // monitoring so a degraded Python engine is not silently masked.
            logger.error('ai.analyze.primary_engine_failed', {
                reason: 'non_ok_response',
                status: fastApiResponse.status,
                userId,
            });
        } catch (primaryError) {
            // FastAPI offline / timeout -> fall back to the TypeScript Genkit engine below.
            // Log the failure so a down primary engine is visible in monitoring.
            logger.error('ai.analyze.primary_engine_failed', {
                reason: 'unreachable',
                errorMessage: primaryError instanceof Error ? primaryError.message : String(primaryError),
                userId,
            });
        }

        // 2. TypeScript Multi-Agent Orchestrator Fallback Engine
        logger.warn('ai.analyze.fallback_engine_served', {
            engine: 'Next.js (TypeScript Engine)',
            userId,
        });
        const result = await executeMultiAgentPipeline({
            symptoms,
            imageUrl,
            bodyLocation,
            durationDays,
            userId,
        });

        return NextResponse.json({
            ...result,
            microservice: 'Next.js (TypeScript Engine)',
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal pipeline error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
