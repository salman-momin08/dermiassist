
'use server';
/**
 * @fileOverview Generates a comprehensive case file summary for a doctor.
 *
 * - generateCaseFileSummary - A function that synthesizes patient data into a case file.
 * - GenerateCaseFileSummaryInput - The input type for the generateCaseFileSummary function.
 * - GenerateCaseFileSummaryOutput - The return type for the generateCaseFileSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const GenerateCaseFileSummaryInputSchema = z.object({
  patientName: z.string().describe("The patient's full name."),
  reportCondition: z.string().describe("The condition identified in the latest AI report."),
  reportFullText: z.string().describe('The complete AI skin analysis report.'),
  previousNotes: z.string().optional().describe('Notes from previous consultations, if any.'),
});
export type GenerateCaseFileSummaryInput = z.infer<typeof GenerateCaseFileSummaryInputSchema>;

const GenerateCaseFileSummaryOutputSchema = z.object({
  summary: z.string().describe('A structured summary of the patient case file.'),
});
export type GenerateCaseFileSummaryOutput = z.infer<typeof GenerateCaseFileSummaryOutputSchema>;

export async function generateCaseFileSummary(input: GenerateCaseFileSummaryInput): Promise<GenerateCaseFileSummaryOutput> {
  return generateCaseFileSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCaseFileSummaryPrompt',
  input: {schema: GenerateCaseFileSummaryInputSchema},
  output: {schema: GenerateCaseFileSummaryOutputSchema},
  prompt: `You are a helpful medical assistant AI. Your task is to create a concise and structured case file summary for a doctor to review before an appointment. You must not disclose any personally identifiable information beyond what is explicitly provided in the input fields.

Synthesize the information from the provided AI report and any previous notes into a clear, easy-to-read summary.

Patient Name: {{{patientName}}}

The summary should follow this structure:
**1. Presenting Condition:** Based on the latest AI report ({{{reportCondition}}}).
**2. Key Findings from AI Report:** Extract the most critical points from the full report text.
**3. Previous History & Notes:** Summarize any past interactions or notes if available. If not, state "No previous notes on file."
**4. Patient-Provided Information:** List the pre-medication and disease duration mentioned in the report.

Here is the information to use:

**Full AI Report Text:**
{{{reportFullText}}}

**Previous Consultation Notes:**
{{{previousNotes}}}
`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
       {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
    ],
  },
});

const generateCaseFileSummaryFlow = ai.defineFlow(
  {
    name: 'generateCaseFileSummaryFlow',
    inputSchema: GenerateCaseFileSummaryInputSchema,
    outputSchema: GenerateCaseFileSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
