/**
 * @fileOverview LLM-as-a-Judge Evaluation & Benchmarking Harness.
 * Runs benchmark cases against the Multi-Agent AI Orchestrator and calculates metrics for:
 * 1. Diagnostic Condition Accuracy
 * 2. Grounded RAG Citation Coverage
 * 3. Safety Disclaimer Compliance Rate
 * 4. Latency Benchmark Score
 */

import { executeMultiAgentPipeline } from '@/ai/orchestrator';
import benchmarks from './datasets/dermatology-benchmarks.json';
import { logger } from '@/lib/logger';

export interface EvalCaseResult {
    caseId: string;
    caseTitle: string;
    passed: boolean;
    conditionMatchScore: number;
    hasDisclaimers: boolean;
    hasCitations: boolean;
    executionTimeMs: number;
    evaluatedCondition: string;
    expectedCondition: string;
}

export interface AggregateEvalReport {
    timestamp: string;
    totalCases: number;
    passedCases: number;
    accuracyPercentage: number;
    citationCoveragePercentage: number;
    disclaimerCompliancePercentage: number;
    avgLatencyMs: number;
    results: EvalCaseResult[];
}

/**
 * Execute the AI Evaluation & Benchmarking Harness.
 */
export async function runAIEvalHarness(): Promise<AggregateEvalReport> {
    logger.info('ai.eval.harness.started', { totalCases: benchmarks.length });

    const results: EvalCaseResult[] = [];
    let totalLatency = 0;
    let passedCount = 0;
    let citationsCount = 0;
    let disclaimersCount = 0;

    for (const testCase of benchmarks) {
        const startTime = Date.now();
        
        const pipelineResult = await executeMultiAgentPipeline({
            symptoms: testCase.inputSymptoms,
        });

        const executionTimeMs = Date.now() - startTime;
        totalLatency += executionTimeMs;

        const evaluatedCondition = pipelineResult.report.primaryConditionName || '';
        const expectedCondition = testCase.expectedCondition;

        // Condition matching logic (case-insensitive substring or match)
        const conditionMatch = evaluatedCondition.toLowerCase().includes(expectedCondition.toLowerCase()) ||
            expectedCondition.toLowerCase().includes(evaluatedCondition.toLowerCase());

        const conditionMatchScore = conditionMatch ? 100 : 50;
        const hasDisclaimers = pipelineResult.safety.disclaimerAppended || pipelineResult.report.summary.includes('Medical Disclaimer');
        const hasCitations = pipelineResult.report.citationsUsed.length > 0;

        if (conditionMatch) passedCount++;
        if (hasCitations) citationsCount++;
        if (hasDisclaimers) disclaimersCount++;

        results.push({
            caseId: testCase.id,
            caseTitle: testCase.caseTitle,
            passed: conditionMatch,
            conditionMatchScore,
            hasDisclaimers,
            hasCitations,
            executionTimeMs,
            evaluatedCondition,
            expectedCondition,
        });
    }

    const aggregateReport: AggregateEvalReport = {
        timestamp: new Date().toISOString(),
        totalCases: benchmarks.length,
        passedCases: passedCount,
        accuracyPercentage: Math.round((passedCount / benchmarks.length) * 100),
        citationCoveragePercentage: Math.round((citationsCount / benchmarks.length) * 100),
        disclaimerCompliancePercentage: Math.round((disclaimersCount / benchmarks.length) * 100),
        avgLatencyMs: Math.round(totalLatency / benchmarks.length),
        results,
    };

    logger.info('ai.eval.harness.completed', {
        accuracy: aggregateReport.accuracyPercentage,
        avgLatencyMs: aggregateReport.avgLatencyMs,
    });

    return aggregateReport;
}
