/**
 * @fileOverview Multimodal Vision Lesion Agent.
 * Analyzes skin lesion photos using Gemini 2.5 Vision model,
 * extracting clinical morphological characteristics (ABCDE criteria, lesion type, skin tone).
 *
 * Performance: maxOutputTokens=512, temperature=0.2 for fast, deterministic visual analysis.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { logger } from '@/lib/logger';

export const VisionInputSchema = z.object({
    imageUrl: z.string().describe('URL or Base64 data URI of the skin lesion photo.'),
    bodyLocation: z.string().optional().describe('Body part location (e.g., face, arm, back).'),
});
export type VisionInput = z.infer<typeof VisionInputSchema>;

export const VisionOutputSchema = z.object({
    lesionType: z.string().describe('Primary morphological classification (e.g. Macule, Papule, Plaque, Vesicle, Nodule).'),
    colorProfile: z.array(z.string()).describe('Dominant colors observed.'),
    borderCharacteristics: z.enum(['well-demarcated', 'irregular', 'scaly-border', 'diffuse', 'not-assessed']).describe('Border clarity. "not-assessed" indicates no image was analyzed.'),
    suspectedConditions: z.array(z.string()).describe('Top visual differential possibilities.'),
    visualConfidence: z.number().min(0).max(100).describe('Visual feature detection confidence score.'),
});
export type VisionOutput = z.infer<typeof VisionOutputSchema>;

const visionPrompt = ai.definePrompt({
    name: 'multimodalVisionPrompt',
    input: { schema: VisionInputSchema },
    output: { schema: VisionOutputSchema },
    config: {
        maxOutputTokens: 512,
        temperature: 0.2,
    },
    prompt: `You are a Dermatopathologist. Analyze the skin lesion image and extract:
1. Lesion Type (Macule, Papule, Plaque, Vesicle, Pustule, Nodule, Scale)
2. Color Profile (Erythematous, Hyperpigmented, Violaceous, Hypopigmented)
3. Border Clarity (Well-demarcated, Irregular, Diffuse)
4. Top Differential Possibilities

Body Location: {{#if bodyLocation}}{{{bodyLocation}}}{{else}}Unspecified{{/if}}
Image URL: {{{imageUrl}}}
`,
});

export async function runVisionAgent(input: VisionInput): Promise<VisionOutput> {
    logger.info('agent.vision.started', { bodyLocation: input.bodyLocation });

    try {
        const result = await visionPrompt(input);
        if (!result.output) {
            throw new Error('Vision agent failed to analyze image features.');
        }

        logger.info('agent.vision.completed', {
            lesionType: result.output.lesionType,
            visualConfidence: result.output.visualConfidence,
        });

        return result.output;
    } catch (err) {
        // Honest failure: fabricating a lesion type / suspected conditions / confidence
        // would mask a broken vision model behind confident-looking output. Surface the
        // failure so the caller can decide how to degrade (e.g. fall back to a
        // "not analyzed" block) rather than inventing visual findings.
        logger.error('agent.vision.failed', { error: String(err) });
        throw err instanceof Error ? err : new Error(String(err));
    }
}
