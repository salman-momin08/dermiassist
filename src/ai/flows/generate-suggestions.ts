'use server';

/**
 * @fileOverview An AI Agent flow dedicated to generating dynamic, context-aware quick answer
 * suggestions for dermatological consultation questions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const GenerateSuggestionsInputSchema = z.object({
  question: z.string().describe('The clinical question asked to the patient.'),
  conditionName: z.string().optional().describe('The detected skin condition name.'),
  conversationHistory: z.string().optional().describe('Prior consultation Q&A context.'),
});
export type GenerateSuggestionsInput = z.infer<typeof GenerateSuggestionsInputSchema>;

export const GenerateSuggestionsOutputSchema = z.object({
  suggestions: z.array(z.string()).describe('An array of 3 to 4 short, realistic response options (2-6 words each) tailored specifically to the question.'),
});
export type GenerateSuggestionsOutput = z.infer<typeof GenerateSuggestionsOutputSchema>;

const prompt = ai.definePrompt({
  name: 'generateQuestionSuggestionsPrompt',
  input: { schema: GenerateSuggestionsInputSchema },
  output: { schema: GenerateSuggestionsOutputSchema },
  prompt: `You are a specialized clinical assistant AI agent for DermiAssist-AI.
Your ONLY role is to generate 3 to 4 realistic, distinct, concise patient response options (2 to 6 words each) for a patient answering the following clinical question.

{{#if conditionName}}
Identified Clinical Condition: {{conditionName}}
{{/if}}

Question to the Patient:
"{{{question}}}"

{{#if conversationHistory}}
Prior Conversation Context:
{{{conversationHistory}}}
{{/if}}

Rules:
1. Every option must directly and naturally answer the specific question asked.
2. If the question asks about medications or existing health conditions, provide options about medication status (e.g. "No medications or conditions", "Taking daily prescription meds", "Using topical hydrocortisone").
3. If the question asks about duration/timeline, provide realistic timeline ranges (e.g. "Started 2-3 days ago", "1-2 weeks", "Several months").
4. If the question asks about sensations (itch/pain), provide distinct severity levels (e.g. "Intense itching, no pain", "Mild burning sensation", "Completely painless").
5. Keep options concise, natural, patient-friendly, and distinct from one another.
`,
});

export const generateSuggestionsFlow = ai.defineFlow(
  {
    name: 'generateSuggestionsFlow',
    inputSchema: GenerateSuggestionsInputSchema,
    outputSchema: GenerateSuggestionsOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      if (output && output.suggestions && output.suggestions.length > 0) {
        return {
          suggestions: output.suggestions.slice(0, 4),
        };
      }
    } catch (err) {
      console.warn('[generateSuggestionsFlow] Error generating dynamic suggestions:', err);
    }

    return {
      suggestions: [
        "Yes, experiencing this symptom",
        "No, not present",
        "Mild discomfort only",
        "Started a few days ago",
      ],
    };
  }
);

import { callPythonLangGraphSuggestions } from '@/lib/python-ai-client';

export async function generateQuestionSuggestions(
  input: GenerateSuggestionsInput
): Promise<GenerateSuggestionsOutput> {
  // 1. Primary: Python LangGraph AI Microservice
  const pythonRes = await callPythonLangGraphSuggestions(
    input.question,
    input.conditionName,
    input.conversationHistory
  );

  if (pythonRes && pythonRes.suggestions && pythonRes.suggestions.length > 0) {
    return {
      suggestions: pythonRes.suggestions.slice(0, 4),
    };
  }

  // 2. Fallback: TypeScript Genkit Flow
  return generateSuggestionsFlow(input);
}
