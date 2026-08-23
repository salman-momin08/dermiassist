
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
import { AIOutputError } from '@/lib/errors';

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


import { callPythonLangGraphEvaluation } from '@/lib/python-ai-client';

export async function finalEvaluation(
  input: FinalEvaluationInput
): Promise<FinalEvaluationOutput> {
  // 1. Prioritize Python LangGraph Multi-Agent Engine
  const langgraphRes = await callPythonLangGraphEvaluation(
    input.initialCondition,
    input.userAnswers,
    input.photoDataUri
  );

  if (langgraphRes && langgraphRes.conditionName && langgraphRes.recommendations) {
    return {
      conditionName: langgraphRes.conditionName,
      condition: langgraphRes.condition,
      dos: langgraphRes.dos,
      donts: langgraphRes.donts,
      recommendations: langgraphRes.recommendations,
      otherConsiderations: langgraphRes.otherConsiderations,
    };
  }

  // 2. Fallback to TypeScript Genkit flow
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
    // Retry up to 2 times on transient network / model errors
    let lastError: any = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { output } = await prompt(input);
        if (output && output.conditionName && output.recommendations) {
          return output;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[finalEvaluationFlow] Attempt ${attempt} failed:`, err?.message || err);
        if (attempt < 2) {
          await new Promise(res => setTimeout(res, 1200));
        }
      }
    }

    // Honest failure: both the Python LangGraph engine and the Genkit retries have
    // failed. Fabricating a clinical report here would mask a broken model behind a
    // confident-looking diagnosis, so surface the failure to the caller/UI instead.
    console.error('[finalEvaluationFlow] Evaluation failed after retries:', lastError?.message || lastError);
    throw new AIOutputError(
      `Failed to generate final evaluation report: ${lastError?.message || 'Model returned null or incomplete output'}`,
      { flow: 'finalEvaluationFlow', initialCondition: input.initialCondition }
    );
  }
);
