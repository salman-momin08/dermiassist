
'use server';

/**
 * @fileOverview An AI flow to detect only the name of a skin condition from an image.
 *
 * - detectDiseaseName - A function that identifies the most likely skin condition name.
 * - DetectDiseaseNameInput - The input type for the detectDiseaseName function.
 * - DetectDiseaseNameOutput - The return type for the detectDiseaseName function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const DetectDiseaseNameInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of the skin, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type DetectDiseaseNameInput = z.infer<typeof DetectDiseaseNameInputSchema>;

const DetectDiseaseNameOutputSchema = z.object({
  conditionName: z.string().describe('The short, common name of the most likely skin condition (e.g., Acne Vulgaris, Eczema, Psoriasis).'),
});
export type DetectDiseaseNameOutput = z.infer<typeof DetectDiseaseNameOutputSchema>;

export async function detectDiseaseName(
  input: DetectDiseaseNameInput
): Promise<DetectDiseaseNameOutput> {
  return detectDiseaseNameFlow(input);
}

const prompt = ai.definePrompt({
  name: 'detectDiseaseNamePrompt',
  input: {schema: DetectDiseaseNameInputSchema},
  output: {schema: DetectDiseaseNameOutputSchema},
  prompt: `You are an expert dermatologist AI. Analyze the provided image of a skin condition.
Your ONLY task is to identify the most likely skin condition and return its common medical name.
Do not provide any other information, summary, or recommendations. Just the condition name.

Photo: {{media url=photoDataUri}}
`,
});

const detectDiseaseNameFlow = ai.defineFlow(
  {
    name: 'detectDiseaseNameFlow',
    inputSchema: DetectDiseaseNameInputSchema,
    outputSchema: DetectDiseaseNameOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
