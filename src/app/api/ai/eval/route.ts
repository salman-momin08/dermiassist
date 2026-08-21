import { NextResponse } from 'next/server';
import { runAIEvalHarness } from '@/ai/eval/eval-harness';

export async function GET() {
    try {
        const report = await runAIEvalHarness();
        return NextResponse.json(report);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Evaluation harness error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
