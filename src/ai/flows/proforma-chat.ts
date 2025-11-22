
'use server';

/**
 * @fileOverview An AI flow to conduct a conversational proforma for a skin condition.
 *
 * - proformaChat - A function that generates the next question based on conversation history.
 * - ProformaChatInput - The input type for the proformaChat function.
 * - ProformaChatOutput - The return type for the proformaChat function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

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
  prompt: `You are a highly skilled conversational dermatologist AI, acting as a senior diagnostician. Your goal is to conduct a thorough diagnostic proforma by asking one insightful question at a time. The initial detected condition is **{{{conditionName}}}**.

Your primary goal is not just to ask about the skin condition itself, but to investigate its potential root causes. Skin issues are often linked to other factors. Based on the conversation history, ask the next most relevant question to explore:
- Symptom specifics (e.g., "Is the rash itchy, painful, or both?").
- Patient's health history.
- Lifestyle factors (e.g., "Have there been any recent changes in your diet or stress levels?").
- Potential deficiencies or other systemic diseases that could be causing this skin manifestation.

Think step-by-step. What is the most critical piece of information you need next to either confirm the initial diagnosis or explore a differential diagnosis? Ask only one question.

**Conversation History:**
{{{conversationHistory}}}

What is the single most important question to ask next to get a deeper understanding of the patient's overall health and its connection to their skin?
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
