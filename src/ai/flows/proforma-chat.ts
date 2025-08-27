
'use server';

/**
 * @fileOverview An AI flow to conduct a conversational proforma for a skin condition.
 *
 * - proformaChat - A function that generates the next question based on conversation history.
 * - ProformaChatInput - The input type for the proformaChat function.
 * - ProformaChatOutput - The return type for the proformaChat function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProformaChatInputSchema = z.object({
  conditionName: z.string().describe('The name of the detected skin condition.'),
  conversationHistory: z.string().describe('The history of the conversation so far, with "AI:" and "User:" prefixes.'),
});
export type ProformaChatInput = z.infer<typeof ProformaChatInputSchema>;

const ProformaChatOutputSchema = z.object({
  nextQuestion: z.string().describe('The next single, relevant question to ask the user.'),
});
export type ProformaChatOutput = z.infer<typeof ProformaChatOutputSchema>;

export async function proformaChat(
  input: ProformaChatInput
): Promise<ProformaChatOutput> {
  return proformaChatFlow(input);
}

const prompt = ai.definePrompt({
  name: 'proformaChatPrompt',
  input: {schema: ProformaChatInputSchema},
  output: {schema: ProformaChatOutputSchema},
  prompt: `You are a conversational dermatologist AI conducting a proforma. Your goal is to ask one question at a time to gather information about a patient's skin condition. The detected condition is **{{{conditionName}}}**.

Based on the conversation history so far, determine the best *next* question to ask. Your questions should be thorough and what a real doctor would ask. Do not repeat questions. Ask about symptom details, history, lifestyle factors, and previous treatments.

**Conversation History:**
{{{conversationHistory}}}

What is the single most important question to ask next?
`,
});

const proformaChatFlow = ai.defineFlow(
  {
    name: 'proformaChatFlow',
    inputSchema: ProformaChatInputSchema,
    outputSchema: ProformaChatOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
