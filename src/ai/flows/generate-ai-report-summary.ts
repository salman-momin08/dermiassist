
'use server';
/**
 * @fileOverview Generates a summary of the AI skin analysis report for doctors.
 *
 * - generateAiReportSummary - A function that generates the summary.
 * - GenerateAiReportSummaryInput - The input type for the generateAiReportSummary function.
 * - GenerateAiReportSummaryOutput - The return type for the generateAiReportSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const GenerateAiReportSummaryInputSchema = z.object({
  report: z.string().describe('The complete AI skin analysis report.'),
});
export type GenerateAiReportSummaryInput = z.infer<typeof GenerateAiReportSummaryInputSchema>;

const GenerateAiReportSummaryOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the AI skin analysis report.'),
});
export type GenerateAiReportSummaryOutput = z.infer<typeof GenerateAiReportSummaryOutputSchema>;

export async function generateAiReportSummary(input: GenerateAiReportSummaryInput): Promise<GenerateAiReportSummaryOutput> {
  return generateAiReportSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAiReportSummaryPrompt',
  input: {schema: GenerateAiReportSummaryInputSchema},
  output: {schema: GenerateAiReportSummaryOutputSchema},
  prompt: `You are an AI assistant summarizing a dermatology report for a doctor.
        Please provide a concise summary of the key findings and recommendations from the following AI skin analysis report. Focus on aspects relevant to treatment decisions.
        Report: {{{report}}}`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
    ],
  },
});

const generateAiReportSummaryFlow = ai.defineFlow(
  {
    name: 'generateAiReportSummaryFlow',
    inputSchema: GenerateAiReportSummaryInputSchema,
    outputSchema: GenerateAiReportSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
