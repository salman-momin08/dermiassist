/**
 * @fileOverview Output Guardrail Module.
 * Scans LLM outputs for hallucination indicators, confidence thresholding,
 * mandatory medical disclaimers, and schema safety.
 */

import { logger } from '@/lib/logger';

export interface GuardrailOutputResult<T = unknown> {
    valid: boolean;
    data: T;
    /** `null` when the model omitted a confidence score (treated as unknown/high-risk). */
    confidenceScore: number | null;
    hallucinationRisk: 'low' | 'medium' | 'high';
    disclaimerAppended: boolean;
    violations: string[];
}

const MANDATORY_MEDICAL_DISCLAIMER = 
    "\n\n**Medical Disclaimer**: DermiAssist-AI provides preliminary informational analysis using artificial intelligence and does NOT provide definitive medical diagnoses or replace evaluation by a licensed dermatologist. Always consult a qualified healthcare professional for medical advice.";

/**
 * Validate AI report output for safety, hallucination, and legal compliance.
 */
export function validateOutputSafety<T extends { reportData?: Record<string, unknown>; confidenceScore?: number; response?: string }>(
    rawOutput: T
): GuardrailOutputResult<T> {
    const violations: string[] = [];
    let hallucinationRisk: 'low' | 'medium' | 'high' = 'low';
    let disclaimerAppended = false;

    // 1. Confidence Calibration Check
    // A missing confidence score must NOT be treated as a passing default (previously 75).
    // Absence of a confidence signal is itself a red flag, so treat it as unknown => high risk.
    const confidenceScore: number | null = typeof rawOutput.confidenceScore === 'number'
        ? rawOutput.confidenceScore
        : null;

    if (confidenceScore === null) {
        violations.push('Missing AI confidence score. Confidence unknown — mandatory clinical verification required.');
        hallucinationRisk = 'high';
    } else if (confidenceScore < 50) {
        violations.push('Low AI confidence score (< 50%). Mandatory clinical verification required.');
        hallucinationRisk = 'high';
    } else if (confidenceScore < 70) {
        hallucinationRisk = 'medium';
    }

    // 2. Ensure Medical Disclaimer Presence
    let outputCopy = { ...rawOutput };
    if (typeof outputCopy.response === 'string') {
        if (!outputCopy.response.includes('Medical Disclaimer')) {
            outputCopy.response += MANDATORY_MEDICAL_DISCLAIMER;
            disclaimerAppended = true;
        }
    }

    if (violations.length > 0) {
        logger.warn('ai.guardrail.output.violations', {
            violations,
            confidenceScore,
            hallucinationRisk,
        });
    }

    return {
        valid: violations.length === 0,
        data: outputCopy,
        confidenceScore,
        hallucinationRisk,
        disclaimerAppended,
        violations,
    };
}
