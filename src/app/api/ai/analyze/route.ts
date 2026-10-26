import { NextRequest, NextResponse } from 'next/server';
import { executeMultiAgentPipeline } from '@/ai/orchestrator';
import { checkRateLimit, RateLimitPresets } from '@/lib/redis/rate-limit';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { AnalysisRequestSchema } from '@/ai/analysis-request';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const body = AnalysisRequestSchema.safeParse(await request.json());
        if (!body.success) {
            return NextResponse.json(
                { error: 'Invalid analysis parameters.', details: body.error.flatten() },
                { status: 400 }
            );
        }
        const { symptoms, imageUrl, bodyLocation, durationDays, provider } = body.data;
        const userId = user.id;

        // This endpoint runs the full multi-agent pipeline (or an OpenAI call) —
        // rate-limit it the same way as the other AI-invoking flows.
        const identifier = userId;
        const rateLimitResult = await checkRateLimit({
            limit: RateLimitPresets.AI_ANALYSIS.limit,
            window: RateLimitPresets.AI_ANALYSIS.window,
            identifier,
            endpoint: '/api/ai/analyze',
        });
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: rateLimitResult.unavailable ? 'Request protection is temporarily unavailable.' : 'Rate limit exceeded. Please try again later.' },
                { status: rateLimitResult.unavailable ? 503 : 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter ?? 3600) } }
            );
        }

        // 1. Primary engine: FastAPI Python Microservice — REAL open-source
        //    Hugging Face inference with honest failure (no fabricated
        //    diagnosis). Model health is reported consistently.
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
                    // All diagnosis runs on the open-source Hugging Face engine.
                    provider: 'huggingface',
                }),
                // Real model calls take time; allow the pipeline to complete.
                signal: AbortSignal.timeout(30000),
            });

            if (fastApiResponse.ok) {
                const fastApiData = await fastApiResponse.json();
                if (fastApiData.success === true && fastApiData.report) {
                    return NextResponse.json({
                        ...fastApiData,
                        microservice: 'FastAPI (Python)',
                    });
                }
                logger.error('ai.analyze.primary_engine_failed', {
                    reason: 'pipeline_failed',
                    userId,
                });
            }

            // Primary engine reachable but returned a non-OK status — surface it in
            // monitoring so a degraded Python engine is not silently masked.
            if (!fastApiResponse.ok) {
                logger.error('ai.analyze.primary_engine_failed', {
                    reason: 'non_ok_response',
                    status: fastApiResponse.status,
                    userId,
                });
            }
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
        if (err instanceof SyntaxError) {
            return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
        }
        logger.error('ai.analyze.failed', { error: String(err) });
        return NextResponse.json({ error: 'Analysis is unavailable. Please try again later.' }, { status: 503 });
    }
}
