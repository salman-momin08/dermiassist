
'use server';

/**
 * @fileOverview A visual progress analysis AI agent for comparing skin conditions over time.
 *
 * - visualProgressAnalysis - A function that handles the comparison of two skin photos.
 * - VisualProgressAnalysisInput - The input type for the visualProgressAnalysis function.
 * - VisualProgressAnalysisOutput - The return type for the visualProgressAnalysis function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const VisualProgressAnalysisInputSchema = z.object({
  originalPhotoDataUri: z
    .string()
    .describe(
      "The original photo of the skin condition, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  newPhotoDataUri: z
    .string()
    .describe(
      "The new photo of the skin condition for comparison, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  condition: z.string().describe('The diagnosed skin condition for context.'),
});
export type VisualProgressAnalysisInput = z.infer<typeof VisualProgressAnalysisInputSchema>;

const VisualProgressAnalysisOutputSchema = z.object({
  progressSummary: z.string().describe('A summary of the visual progress between the two photos.'),
});
export type VisualProgressAnalysisOutput = z.infer<typeof VisualProgressAnalysisOutputSchema>;

export async function visualProgressAnalysis(
  input: VisualProgressAnalysisInput
): Promise<VisualProgressAnalysisOutput> {
  return visualProgressAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'visualProgressAnalysisPrompt',
  input: {schema: VisualProgressAnalysisInputSchema},
  output: {schema: VisualProgressAnalysisOutputSchema},
  prompt: `You are an expert dermatologist AI. Your task is to compare two images of a patient's skin condition, which has been diagnosed as {{{condition}}}.

The first image is the original baseline, and the second is a follow-up photo.

Analyze the visual changes between the original photo and the new photo. Provide a concise, encouraging, and easy-to-understand summary of the progress. Focus on changes in redness, size of the affected area, inflammation, or texture. If there is no noticeable change, state that. Do not provide medical advice, just a visual comparison.

Original Photo:
{{media url=originalPhotoDataUri}}

New Photo:
{{media url=newPhotoDataUri}}
`,
});

const visualProgressAnalysisFlow = ai.defineFlow(
  {
    name: 'visualProgressAnalysisFlow',
    inputSchema: VisualProgressAnalysisInputSchema,
    outputSchema: VisualProgressAnalysisOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
