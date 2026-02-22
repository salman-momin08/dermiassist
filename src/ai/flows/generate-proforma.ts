
'use server';

/**
 * @fileOverview An AI flow to generate a dynamic proforma (questionnaire) for a given skin condition.
 *
 * - generateProforma - A function that creates a list of questions for a patient.
 * - GenerateProformaInput - The input type for the generateProforma function.
 * - GenerateProformaOutput - The return type for the generateProforma function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const GenerateProformaInputSchema = z.object({
  conditionName: z.string().describe('The name of the skin condition to generate questions for.'),
});
export type GenerateProformaInput = z.infer<typeof GenerateProformaInputSchema>;

const GenerateProformaOutputSchema = z.object({
  questions: z.array(z.string()).describe('An array of 5 to 7 detailed and specific questions a dermatologist would ask about this condition.'),
});
export type GenerateProformaOutput = z.infer<typeof GenerateProformaOutputSchema>;

export async function generateProforma(
  input: GenerateProformaInput
): Promise<GenerateProformaOutput> {
  return generateProformaFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateProformaPrompt',
  input: {schema: GenerateProformaInputSchema},
  output: {schema: GenerateProformaOutputSchema},
  prompt: `You are a highly skilled dermatologist AI. Your task is to create a clinical proforma (a questionnaire) for a patient who has been preliminarily diagnosed with: **{{{conditionName}}}**.

Generate an array of 5 to 7 specific, thorough questions that a real doctor would ask to get a deeper understanding of the patient's condition. The questions should cover symptom details, history, lifestyle factors, and previous treatments.

Example for Acne:
- "Can you describe the types of pimples you are experiencing (e.g., blackheads, whiteheads, painful deep lumps)?"
- "Which areas of your face or body are most affected?"
- "Have you noticed if anything in particular triggers your breakouts, such as diet, stress, or menstrual cycle?"

Now, generate the questions for **{{{conditionName}}}**.
`,
});

const generateProformaFlow = ai.defineFlow(
  {
    name: 'generateProformaFlow',
    inputSchema: GenerateProformaInputSchema,
    outputSchema: GenerateProformaOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
