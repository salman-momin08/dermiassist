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

        const result = await executeMultiAgentPipeline({
            symptoms,
            imageUrl,
            bodyLocation,
            durationDays,
            userId,
        });

        return NextResponse.json(result);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal pipeline error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
