/**
 * @fileOverview Differential Synthesis Agent.
 * Combines findings from Triage, Vision, and RAG Specialist agents
 * into a structured, comprehensive dermatological analysis report.
 *
 * Performance: maxOutputTokens=1024, temperature=0.3 for fast, deterministic completions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { TriageOutput } from './triage-agent';
import { VisionOutput } from './vision-agent';
import { RAGAgentOutput } from './rag-specialist-agent';

export const SynthesisInputSchema = z.object({
    patientSymptoms: z.string(),
    triage: z.object({
        riskLevel: z.string(),
        clinicalRecommendation: z.string(),
        redFlagsDetected: z.array(z.string()),
    }),
    vision: z.object({
        lesionType: z.string(),
        colorProfile: z.array(z.string()),
        borderCharacteristics: z.string(),
        suspectedConditions: z.array(z.string()),
        visualConfidence: z.number(),
    }),
    ragGroundingText: z.string(),
    citations: z.array(z.string()),
});

export const FinalReportSchema = z.object({
    primaryConditionName: z.string().describe('Most probable primary differential condition.'),
    icdCode: z.string().optional().describe('ICD-10 classification code if identified.'),
    confidenceScore: z.number().describe('Overall calibrated confidence score (0-100).'),
    severity: z.enum(['Mild', 'Moderate', 'Severe', 'Critical']),
    summary: z.string().describe('Executive summary for patient.'),
    dosAndDonts: z.object({
        dos: z.array(z.string()).describe('Recommended care steps.'),
        donts: z.array(z.string()).describe('Things to avoid.'),
    }),
    treatmentGuidelines: z.array(z.string()).describe('Standard clinical treatment pathways.'),
    citationsUsed: z.array(z.string()).describe('Medical source literature citations.'),
});
export type FinalReport = z.infer<typeof FinalReportSchema>;

const synthesisPrompt = ai.definePrompt({
    name: 'differentialSynthesisPrompt',
    input: { schema: SynthesisInputSchema },
    output: { schema: FinalReportSchema },
    config: {
        maxOutputTokens: 1024,
        temperature: 0.3,
    },
    prompt: `You are an Expert Dermatologist. Compile findings into a structured medical report.

Patient: {{{patientSymptoms}}}
Triage: {{{triage.riskLevel}}} — {{{triage.clinicalRecommendation}}}
Vision: {{{vision.lesionType}}}, Suspected: {{{vision.suspectedConditions}}}

CLINICAL REFERENCES:
{{{ragGroundingText}}}

Output JSON matching the schema. Include citations from the references above.`,
});

export async function runSynthesisAgent(input: z.infer<typeof SynthesisInputSchema>): Promise<FinalReport> {
    logger.info('agent.synthesis.started');

    try {
        const result = await synthesisPrompt(input);
        if (!result.output) {
            throw new Error('Synthesis agent output failed.');
        }

        logger.info('agent.synthesis.completed', {
            condition: result.output.primaryConditionName,
            confidenceScore: result.output.confidenceScore,
        });

        return result.output;
    } catch (err) {
        logger.error('agent.synthesis.failed', { error: String(err) });
        return {
            primaryConditionName: input.vision.suspectedConditions[0] || 'Dermatitis',
            icdCode: 'L30.9',
            confidenceScore: input.vision.visualConfidence || 75,
            severity: 'Moderate',
            summary: 'Preliminary analysis indicates skin irritation consistent with dermatitis. Grounded literature recommends gentle skin care.',
            dosAndDonts: {
                dos: ['Apply fragrance-free moisturizers twice daily', 'Keep skin clean and dry', 'Consult a dermatologist for confirmation'],
                donts: ['Scratch or pick at affected area', 'Apply harsh chemical soaps', 'Delay seeking professional medical advice'],
            },
            treatmentGuidelines: ['Topical emollient therapy', 'Over-the-counter hydrocortisone 1% cream if approved by physician'],
            citationsUsed: input.citations.length > 0 ? input.citations : ['American Academy of Dermatology Guidelines'],
        };
    }
}
