/**
 * @fileOverview Master Multi-Agent Orchestrator for DermiAssist-AI.
 * Coordinates input guardrails, semantic caching, triage, vision analysis,
 * RAG literature retrieval, differential synthesis, and output safety checks.
 */

import { validateAndSanitizeInput } from '@/ai/guards/input-guard';
import { validateOutputSafety } from '@/ai/guards/output-guard';
import { getSemanticCache, setSemanticCache } from '@/ai/cache/semantic-cache';
import { runTriageAgent } from '@/ai/agents/triage-agent';
import { runVisionAgent, VisionOutput } from '@/ai/agents/vision-agent';
import { runRAGSpecialistAgent } from '@/ai/agents/rag-specialist-agent';
import { runSynthesisAgent, FinalReport } from '@/ai/agents/synthesis-agent';
import { logger } from '@/lib/logger';
import { recordAiTelemetry } from '@/lib/telemetry';

export interface MultiAgentPipelineInput {
    symptoms: string;
    imageUrl?: string;
    bodyLocation?: string;
    durationDays?: number;
    userId?: string;
}

export interface MultiAgentPipelineResult {
    success: boolean;
    cached: boolean;
    report: FinalReport;
    executionTimeMs: number;
    agentTrace: {
        agent: string;
        status: 'success' | 'fallback' | 'skipped';
        durationMs: number;
        error?: string;
    }[];
    safety: {
        inputSanitized: boolean;
        hallucinationRisk: 'low' | 'medium' | 'high';
        disclaimerAppended: boolean;
    };
}

/**
 * Execute full multi-agent diagnostic orchestration pipeline.
 */
export async function executeMultiAgentPipeline(
    input: MultiAgentPipelineInput
): Promise<MultiAgentPipelineResult> {
    const startTime = Date.now();
    const traceLog: MultiAgentPipelineResult['agentTrace'] = [];

    logger.info('ai.orchestrator.pipeline.started', {
        userId: input.userId,
        hasImage: !!input.imageUrl,
    });

    // ── STEP 1: Input Guardrail & PII Sanitization ────────────────
    const guardrailStepStart = Date.now();
    const inputGuard = validateAndSanitizeInput(input.symptoms);
    traceLog.push({
        agent: 'InputGuardrailAgent',
        status: inputGuard.safe ? 'success' : 'fallback',
        durationMs: Date.now() - guardrailStepStart,
    });

    const cleanSymptoms = inputGuard.sanitizedPrompt;

    // ── STEP 2: Semantic Cache Lookup ──────────────────────────────
    const cacheStepStart = Date.now();
    const cachedReport = await getSemanticCache<FinalReport>(cleanSymptoms);
    traceLog.push({
        agent: 'SemanticCacheAgent',
        status: cachedReport ? 'success' : 'skipped',
        durationMs: Date.now() - cacheStepStart,
    });

    if (cachedReport) {
        logger.info('ai.orchestrator.cache.hit');
        return {
            success: true,
            cached: true,
            report: cachedReport,
            executionTimeMs: Date.now() - startTime,
            agentTrace: traceLog,
            safety: {
                inputSanitized: inputGuard.piiDetected,
                hallucinationRisk: 'low',
                disclaimerAppended: true,
            },
        };
    }

    // Honest "not analyzed" vision block. Used when no image is provided OR when the
    // vision model fails — we never fabricate a lesion type, suspected conditions, or a
    // visual confidence for images we did not (or could not) actually analyze.
    const notAnalyzedVision: VisionOutput = {
        lesionType: 'Not analyzed (no image provided)',
        colorProfile: [],
        borderCharacteristics: 'not-assessed',
        suspectedConditions: [],
        visualConfidence: 0,
    };

    // ── STEP 3: Concurrent Execution of Triage & Vision, then RAG ───
    const triageStart = Date.now();
    const triagePromise = runTriageAgent({
        symptoms: cleanSymptoms,
        durationDays: input.durationDays,
        imageProvided: !!input.imageUrl,
    });

    const visionStart = Date.now();
    let visionStatus: 'success' | 'fallback' | 'skipped' = input.imageUrl ? 'success' : 'skipped';
    let visionError: string | undefined;
    const visionPromise: Promise<VisionOutput> = input.imageUrl
        ? runVisionAgent({ imageUrl: input.imageUrl, bodyLocation: input.bodyLocation }).catch((err) => {
            // A broken vision model must not fabricate findings. Record the real failure
            // and fall back to the honest "not analyzed" block; synthesis can still run
            // from symptoms + RAG.
            visionStatus = 'fallback';
            visionError = err instanceof Error ? err.message : String(err);
            logger.warn('ai.orchestrator.vision.fallback', { error: visionError });
            return notAnalyzedVision;
        })
        : Promise.resolve(notAnalyzedVision);

    const [triageResult, visionResult] = await Promise.all([
        triagePromise,
        visionPromise,
    ]);

    traceLog.push({
        agent: 'ClinicalTriageAgent',
        status: 'success',
        durationMs: Date.now() - triageStart,
    });

    traceLog.push({
        agent: 'MultimodalVisionAgent',
        status: visionStatus,
        durationMs: Date.now() - visionStart,
        ...(visionError ? { error: visionError } : {}),
    });

    // RAG is seeded with the REAL vision-derived suspected conditions (empty when no
    // image was analyzed), so retrieval is grounded in actual findings rather than a
    // fixed set of biasing conditions.
    const ragStart = Date.now();
    const ragResult = await runRAGSpecialistAgent({
        suspectedConditions: visionResult.suspectedConditions,
        symptomsDescription: cleanSymptoms,
    });

    traceLog.push({
        agent: 'MedicalRAGSpecialistAgent',
        status: 'success',
        durationMs: Date.now() - ragStart,
    });

    // ── STEP 4: Differential Report Synthesis Agent ───────────────
    const synthStart = Date.now();
    const rawReport = await runSynthesisAgent({
        patientSymptoms: cleanSymptoms,
        triage: triageResult,
        vision: visionResult,
        ragGroundingText: ragResult.groundedContextPrompt,
        citations: ragResult.clinicalCitations,
    });

    traceLog.push({
        agent: 'DifferentialSynthesisAgent',
        status: 'success',
        durationMs: Date.now() - synthStart,
    });

    // ── STEP 5: Output Safety Guardrail & Disclaimer Injection ──────
    const outputGuard = validateOutputSafety({
        reportData: rawReport as unknown as Record<string, unknown>,
        confidenceScore: rawReport.confidenceScore,
        response: rawReport.summary,
    });

    const finalReport: FinalReport = {
        ...rawReport,
        summary: outputGuard.data.response || rawReport.summary,
    };

    // ── STEP 6: Save Result to Semantic Cache ──────────────────────
    await setSemanticCache(cleanSymptoms, finalReport);

    const totalExecutionTimeMs = Date.now() - startTime;

    // Record Telemetry
    recordAiTelemetry({
        flowName: 'MultiAgentDiagnosticPipeline',
        executionTimeMs: totalExecutionTimeMs,
        success: true,
        // Token usage is not surfaced by the synthesis agent, so it is intentionally
        // omitted rather than reported as a fabricated character-count estimate.
        metadata: {
            cached: false,
            agentsRun: traceLog.length,
            condition: finalReport.primaryConditionName,
        },
    });

    logger.info('ai.orchestrator.pipeline.completed', {
        executionTimeMs: totalExecutionTimeMs,
        primaryCondition: finalReport.primaryConditionName,
    });

    return {
        success: true,
        cached: false,
        report: finalReport,
        executionTimeMs: totalExecutionTimeMs,
        agentTrace: traceLog,
        safety: {
            inputSanitized: inputGuard.piiDetected,
            hallucinationRisk: outputGuard.hallucinationRisk,
            disclaimerAppended: outputGuard.disclaimerAppended,
        },
    };
}
