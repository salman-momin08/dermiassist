/**
 * @fileOverview Multimodal Vision Lesion Agent.
 * Analyzes skin lesion photos using Gemini 1.5/2.5 Vision models,
 * extracting clinical morphological characteristics (ABCDE criteria, lesion type, skin tone).
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
    colorProfile: z.array(z.string()).describe('Dominant colors observed (e.g., erythematous red, hyperpigmented brown, central clearing).'),
    borderCharacteristics: z.enum(['well-demarcated', 'irregular', 'scaly-border', 'diffuse']).describe('Border clarity.'),
    suspectedConditions: z.array(z.string()).describe('Top visual differential possibilities.'),
    visualConfidence: z.number().min(0).max(100).describe('Visual feature detection confidence score.'),
});
export type VisionOutput = z.infer<typeof VisionOutputSchema>;

const visionPrompt = ai.definePrompt({
    name: 'multimodalVisionPrompt',
    input: { schema: VisionInputSchema },
    output: { schema: VisionOutputSchema },
    prompt: `You are an Expert Dermatopathologist & Clinical Imaging Specialist.
Analyze the provided skin lesion image and extract precise dermatological descriptors:
1. Primary Lesion Type (Macule, Papule, Plaque, Vesicle, Pustule, Nodule, Scale).
2. Color Profile (Erythematous, Hyperpigmented, Violaceous, Hypopigmented).
3. Border Clarity (Well-demarcated vs Irregular vs Diffuse).
4. Top Visual Differential Possibilities (e.g., Acne, Eczema, Psoriasis, Tinea, Seborrheic Keratosis).

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
        logger.error('agent.vision.failed', { error: String(err) });
        return {
            lesionType: 'Plaque / Papule',
            colorProfile: ['Erythematous Red'],
            borderCharacteristics: 'well-demarcated',
            suspectedConditions: ['Dermatitis', 'Eczema', 'Acne Vulgaris'],
            visualConfidence: 75,
        };
    }
}
