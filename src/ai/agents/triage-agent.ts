/**
 * @fileOverview Clinical Triage Agent.
 * Evaluates patient symptoms and history to stratify medical urgency
 * (Emergency Red-Flags vs Urgent Consultation vs Routine Case).
 */

import { ai } from '@/ai/genkit';
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

const triagePrompt = ai.definePrompt({
    name: 'clinicalTriagePrompt',
    input: { schema: TriageInputSchema },
    output: { schema: TriageOutputSchema },
    prompt: `You are a Board-Certified Dermatology Triage Nurse Specialist.
Your job is to analyze patient symptoms and stratify clinical risk into:
1. "emergency" (e.g. Stevens-Johnson syndrome indicators, severe anaphylaxis, rapidly spreading necrotizing rash with high fever).
2. "urgent" (e.g. acute severe eczema flare, suspected localized infection, painful shingles/herpes zoster).
3. "routine" (e.g. chronic acne, mild eczema, routine mole check, tinea versicolor).

Analyze the input carefully and output structured JSON matching the requested schema.

Patient Input:
Symptoms: {{{symptoms}}}
Duration Days: {{#if durationDays}}{{{durationDays}}}{{else}}Not specified{{/if}}
Systemic Symptoms: {{#if systemicSymptoms}}{{{systemicSymptoms}}}{{else}}None reported{{/if}}
Image Attached: {{{imageProvided}}}
`,
});

export async function runTriageAgent(input: TriageInput): Promise<TriageOutput> {
    logger.info('agent.triage.started', { symptomsLength: input.symptoms.length });

    try {
        const result = await triagePrompt(input);
        if (!result.output) {
            throw new Error('Triage agent failed to output structured evaluation');
        }

        logger.info('agent.triage.completed', {
            riskLevel: result.output.riskLevel,
            redFlagsCount: result.output.redFlagsDetected.length,
        });

        return result.output;
    } catch (err) {
        logger.error('agent.triage.failed', { error: String(err) });
        // Safe fallback triage
        return {
            riskLevel: 'routine',
            redFlagsDetected: [],
            clinicalRecommendation: 'Routine dermatological evaluation advised.',
            suggestedSpecialty: 'General Dermatology',
        };
    }
}
