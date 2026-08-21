import { NextRequest, NextResponse } from 'next/server';
import { executeMultiAgentPipeline } from '@/ai/orchestrator';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { symptoms, imageUrl, bodyLocation, durationDays, userId } = body;

        if (!symptoms || typeof symptoms !== 'string') {
            return NextResponse.json(
                { error: 'Missing or invalid symptoms parameter.' },
                { status: 400 }
            );
        }

        // 1. Try FastAPI Python Microservice (Port 8000)
        try {
            const fastApiUrl = process.env.FASTAPI_SERVICE_URL || 'http://localhost:8000';
            const fastApiResponse = await fetch(`${fastApiUrl}/api/v1/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symptoms,
                    image_url: imageUrl,
                    body_location: bodyLocation,
                }),
                signal: AbortSignal.timeout(500), // 500ms fast connection timeout
            });

            if (fastApiResponse.ok) {
                const fastApiData = await fastApiResponse.json();
                return NextResponse.json({
                    ...fastApiData,
                    microservice: 'FastAPI (Python)',
                });
            }
        } catch {
            // FastAPI offline -> Seamless fallback to TypeScript Genkit Engine
        }

        // 2. TypeScript Multi-Agent Orchestrator Fallback Engine
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
