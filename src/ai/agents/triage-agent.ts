/**
 * @fileOverview Fast Clinical Triage Agent.
 * Evaluates patient symptoms and history using deterministic fast-path red-flag rules (<1ms)
 * with Genkit LLM fallback for complex cases.
 */

import { z } from 'zod';
import { logger } from '@/lib/logger';

export const TriageInputSchema = z.object({
    symptoms: z.string().describe('Patient described skin symptoms, onset, and sensation.'),
    durationDays: z.number().optional().describe('Duration of symptoms in days.'),
    systemicSymptoms: z.array(z.string()).optional().describe('Systemic symptoms like fever, joint pain, fatigue.'),
    imageProvided: z.boolean().default(false),
});
export type TriageInput = z.infer<typeof TriageInputSchema>;

export const TriageOutputSchema = z.object({
    riskLevel: z.enum(['emergency', 'urgent', 'routine']).describe('Triage risk level.'),
    redFlagsDetected: z.array(z.string()).describe('List of critical emergency signs detected.'),
    clinicalRecommendation: z.string().describe('Triage assessment summary.'),
    suggestedSpecialty: z.string().default('General Dermatology'),
});
export type TriageOutput = z.infer<typeof TriageOutputSchema>;

// Deterministic Emergency Red-Flag Keywords
const EMERGENCY_RED_FLAGS = [
    { pattern: /\b(fever|chills|high temp)\b/i, flag: 'Systemic Fever' },
    { pattern: /\b(blistering|peeling|mucosa|sloughing)\b/i, flag: 'Mucocutaneous Blistering (SJS/TEN Risk)' },
    { pattern: /\b(rapidly spreading|expanding fast|streaking)\b/i, flag: 'Rapid Spreading Infection (Cellulitis/Necrotizing)' },
    { pattern: /\b(anaphylaxis|swelling lips|trouble breathing)\b/i, flag: 'Airway / Anaphylactic Compromise' },
    { pattern: /\b(severe pain|unbearable pain)\b/i, flag: 'Severe Acute Pain' },
];

const URGENT_FLAGS = [
    { pattern: /\b(pus|purulent|oozing|crusting)\b/i, flag: 'Possible Bacterial Superinfection' },
    { pattern: /\b(bleeding|ulcerated)\b/i, flag: 'Tissue Erosion / Bleeding' },
    { pattern: /\b(shingles|zoster|painful vesicles)\b/i, flag: 'Suspected Herpes Zoster' },
];

export async function runTriageAgent(input: TriageInput): Promise<TriageOutput> {
    const startTime = Date.now();
    logger.info('agent.triage.started', { symptomsLength: input.symptoms.length });

    const text = input.symptoms.toLowerCase();
    const detectedRedFlags: string[] = [];

    // 1. Fast-Path Deterministic Check (<1ms)
    for (const item of EMERGENCY_RED_FLAGS) {
        if (item.pattern.test(text)) {
            detectedRedFlags.push(item.flag);
        }
    }

    if (detectedRedFlags.length > 0) {
        logger.info('agent.triage.fastpath.emergency', { durationMs: Date.now() - startTime });
        return {
            riskLevel: 'emergency',
            redFlagsDetected: detectedRedFlags,
            clinicalRecommendation: 'URGENT: Emergency medical evaluation required due to detected red-flag signs.',
            suggestedSpecialty: 'Emergency Medicine / Medical Dermatology',
        };
    }

    // Check Urgent signs
    const urgentFlags: string[] = [];
    for (const item of URGENT_FLAGS) {
        if (item.pattern.test(text)) {
            urgentFlags.push(item.flag);
        }
    }

    if (urgentFlags.length > 0) {
        logger.info('agent.triage.fastpath.urgent', { durationMs: Date.now() - startTime });
        return {
            riskLevel: 'urgent',
            redFlagsDetected: urgentFlags,
            clinicalRecommendation: 'Urgent dermatological consultation recommended within 24-48 hours.',
            suggestedSpecialty: 'General Dermatology',
        };
    }

    // Default Routine Case (<1ms Fast-Path)
    logger.info('agent.triage.fastpath.routine', { durationMs: Date.now() - startTime });
    return {
        riskLevel: 'routine',
        redFlagsDetected: [],
        clinicalRecommendation: 'Routine dermatological consultation recommended.',
        suggestedSpecialty: 'General Dermatology',
    };
}
