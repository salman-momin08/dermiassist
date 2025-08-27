'use server';

/**
 * @fileOverview A skin condition analysis AI agent.
 *
 * - skinConditionAnalysis - A function that handles the skin condition analysis process.
 * - SkinConditionAnalysisInput - The input type for the skinConditionAnalysis function.
 * - SkinConditionAnalysisOutput - The return type for the skinConditionAnalysis function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SkinConditionAnalysisInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of the skin, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  preMedication: z
    .string()
    .describe('Details of any pre-medication the patient is taking.'),
  diseaseDuration: z.string().describe('The duration of the skin disease.'),
});
export type SkinConditionAnalysisInput = z.infer<typeof SkinConditionAnalysisInputSchema>;

const SkinConditionAnalysisOutputSchema = z.object({
  conditionName: z.string().describe('The short name of the likely skin condition (e.g., Acne Vulgaris, Eczema).'),
  condition: z.string().describe('A detailed summary about the identified skin condition.'),
  dos: z.array(z.string()).describe('A list of things the patient should do.'),
  donts: z.array(z.string()).describe('A list of things the patient should not do.'),
  recommendations: z.string().describe('Recommendations for the patient.'),
});
export type SkinConditionAnalysisOutput = z.infer<typeof SkinConditionAnalysisOutputSchema>;

export async function skinConditionAnalysis(
  input: SkinConditionAnalysisInput
): Promise<SkinConditionAnalysisOutput> {
  return skinConditionAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'skinConditionAnalysisPrompt',
  input: {schema: SkinConditionAnalysisInputSchema},
  output: {schema: SkinConditionAnalysisOutputSchema},
  prompt: `You are an expert dermatologist AI, specializing in analyzing skin conditions from images and patient information.

You will analyze the provided image and information to determine the likely skin condition, and provide a detailed report with the condition name, a summary about it, do's and don'ts, and recommendations.

First, identify the most likely skin condition and put its common name in the 'conditionName' field.

Then, provide a full analysis based on all the information.

Use the following information to analyze the skin condition:

Pre-medication: {{{preMedication}}}
Disease Duration: {{{diseaseDuration}}}
Photo: {{media url=photoDataUri}}
`,
});

const skinConditionAnalysisFlow = ai.defineFlow(
  {
    name: 'skinConditionAnalysisFlow',
    inputSchema: SkinConditionAnalysisInputSchema,
    outputSchema: SkinConditionAnalysisOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
