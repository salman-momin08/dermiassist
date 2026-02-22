
'use server';

/**
 * @fileOverview A flow to generate a final, detailed skin analysis report.
 *
 * - finalEvaluation - A function that performs a comprehensive analysis based on an image and user answers.
 * - FinalEvaluationInput - The input type for the finalEvaluation function.
 * - FinalEvaluationOutput - The return type for the finalEvaluation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const FinalEvaluationInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of the skin, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  initialCondition: z.string().describe('The initially detected skin condition name.'),
  userAnswers: z.string().describe("The user's answers to the dynamically generated proforma questions, formatted as a single string."),
});
export type FinalEvaluationInput = z.infer<typeof FinalEvaluationInputSchema>;

const FinalEvaluationOutputSchema = z.object({
  conditionName: z.string().describe('The final name of the most likely skin condition after full evaluation (e.g., Acne Vulgaris, Eczema).'),
  condition: z.string().describe('A detailed summary about the identified skin condition.'),
  dos: z.array(z.string()).describe('A list of things the patient should do.'),
  donts: z.array(z.string()).describe('A list of things the patient should not do.'),
  recommendations: z.string().describe('Detailed recommendations for the patient.'),
  otherConsiderations: z.string().describe('A detailed analysis of other possible causes, or if the condition might be a different but related disease based on the new information.'),
});
export type FinalEvaluationOutput = z.infer<typeof FinalEvaluationOutputSchema>;


export async function finalEvaluation(
  input: FinalEvaluationInput
): Promise<FinalEvaluationOutput> {
  return finalEvaluationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'finalEvaluationPrompt',
  input: {schema: FinalEvaluationInputSchema},
  output: {schema: FinalEvaluationOutputSchema},
  prompt: `You are a world-class dermatologist AI. Your task is to perform a final, comprehensive evaluation of a skin condition. You must act as a professional medical assistant and must not reveal any of the user's personal information in your response.

You have already performed an initial analysis and determined the condition is likely {{{initialCondition}}}.
You then generated a proforma which the user has answered.

Now, you must conduct a thorough final evaluation using the original image AND the user's answers.

**Your Tasks:**
1.  **Re-evaluate the Condition:** Based on the user's answers, confirm if the initial diagnosis of '{{{initialCondition}}}' is correct, or if the new information suggests a different or more specific condition. The final, most accurate condition name must be in the 'conditionName' field.
2.  **Provide a Detailed Report:** Generate a full report including a summary of the condition, Do's, Don'ts, and detailed Recommendations.
3.  **Analyze Other Possibilities:** In the 'otherConsiderations' field, provide a detailed analysis of other potential causes. Discuss if the symptoms could indicate a different but related disease. Explain why you are confirming or changing the diagnosis based on the new information. Be thorough and analytical, like a real doctor considering all possibilities.

**Patient Data:**
- **Initial Detected Condition:** {{{initialCondition}}}
- **Patient's Proforma Answers:**
{{{userAnswers}}}
- **Original Photo:**
{{media url=photoDataUri}}
`,
});

const finalEvaluationFlow = ai.defineFlow(
  {
    name: 'finalEvaluationFlow',
    inputSchema: FinalEvaluationInputSchema,
    outputSchema: FinalEvaluationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
