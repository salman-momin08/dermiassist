
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
import { AIOutputError } from '@/lib/errors';

const ProformaChatInputSchema = z.object({
  conditionName: z.string().describe('The name of the detected skin condition.'),
  conversationHistory: z.string().describe('The history of the conversation so far, with "AI:" and "User:" prefixes.'),
});
export type ProformaChatInput = z.infer<typeof ProformaChatInputSchema>;

const ProformaChatOutputSchema = z.object({
  nextQuestion: z.string().describe('The next single, relevant question to ask the user.'),
});
export type ProformaChatOutput = z.infer<typeof ProformaChatOutputSchema>;

import { callPythonLangGraphNextQuestion } from '@/lib/python-ai-client';

export async function proformaChat(
  input: ProformaChatInput
): Promise<ProformaChatOutput> {
  // 1. Prioritize Python LangGraph Multi-Agent Engine
  const langgraphRes = await callPythonLangGraphNextQuestion(input.conditionName, input.conversationHistory);
  if (langgraphRes && langgraphRes.next_question && langgraphRes.next_question.trim().length > 5) {
    return { nextQuestion: langgraphRes.next_question.trim() };
  }

  // 2. Fallback to TypeScript Genkit flow
  return proformaChatFlow(input);
}

const proformaChatFlow = ai.defineFlow(
  {
    name: 'proformaChatFlow',
    inputSchema: ProformaChatInputSchema,
    outputSchema: ProformaChatOutputSchema,
  },
  async input => {
    // Generate 100% dynamic clinical follow-up question using Gemini
    let lastError: any = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.generate({
          system: `You are an expert board-certified dermatologist AI conducting a real-time clinical diagnostic proforma.
The primary differential identified from visual analysis is **${input.conditionName}**.

Your objective is to ask ONE thoughtful, highly relevant clinical follow-up question to investigate:
- Specific morphological symptoms, progression, and timeline.
- Sensations (itching severity, burning, soreness, bleeding).
- Potential triggers, lifestyle factors, contact exposures, or medications.
- Personal or family dermatological/allergic history.
- Response to any previous treatments.

Rules:
1. Formulate the question strictly based on the patient's conversation history.
2. Never repeat a question or topic already answered by the patient.
3. Tailor the medical inquiry specifically to the nuances of ${input.conditionName}.
4. Ask only ONE clear, compassionate question without extra introductory or concluding chatter.`,
          prompt: `Conversation History so far:
${input.conversationHistory}

Based on the above patient history and the suspected condition (${input.conditionName}), ask the single most important next clinical question:`,
        });

        const generatedText = response.text?.trim().replace(/^["']|["']$/g, '');
        if (generatedText && generatedText.length > 8) {
          return { nextQuestion: generatedText };
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[proformaChatFlow] Attempt ${attempt} failed:`, err?.message || err);
        if (attempt < 2) {
          await new Promise(res => setTimeout(res, 800));
        }
      }
    }

    throw new AIOutputError(
      `Failed to generate dynamic proforma question: ${lastError?.message || 'Model did not return text'}`,
      { flow: 'proformaChatFlow' }
    );
  }
);
