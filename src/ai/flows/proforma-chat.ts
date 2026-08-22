
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
  suggestedAnswers: z.array(z.string()).optional().describe('3 to 4 concise, relevant quick-answer suggestions that a patient might choose in response to this specific question.'),
  isComplete: z.boolean().optional().describe('True if the model has gathered sufficient clinical confidence to conclude the proforma.'),
  confidenceScore: z.number().min(0).max(100).optional().describe('Diagnostic confidence percentage (0-100) based on gathered patient history.'),
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
          output: { schema: ProformaChatOutputSchema },
          system: `You are an expert board-certified dermatologist AI conducting a real-time clinical diagnostic proforma.
The primary differential identified from visual analysis is **${input.conditionName}**.

Your objective is to clinically evaluate the patient's presentation through intelligent, dynamic inquiry:
- Investigate specific morphological symptoms, progression, and timeline.
- Assess sensations (itching severity, burning, soreness, bleeding).
- Identify potential triggers, lifestyle factors, contact exposures, or medications.
- Review personal or family dermatological/allergic history.
- Evaluate response to previous topical/systemic treatments.

For every question you ask, provide 3 to 4 distinct, highly realistic short answers (2 to 6 words each) tailored to that specific question.

Output JSON format:
{
  "nextQuestion": "Single clear, compassionate clinical question",
  "suggestedAnswers": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "isComplete": false,
  "confidenceScore": 65
}`,
          prompt: `Conversation History so far:
${input.conversationHistory}

Based on the patient's conversation history and suspected condition (${input.conditionName}), determine the next clinical step:`,
        });

        if (response.output) {
          return {
            nextQuestion: response.output.nextQuestion,
            suggestedAnswers: response.output.suggestedAnswers || [],
            isComplete: Boolean(response.output.isComplete),
            confidenceScore: typeof response.output.confidenceScore === 'number' ? response.output.confidenceScore : 75,
          };
        }

        // Fallback text parsing if raw string returned
        const rawText = response.text?.trim().replace(/^["']|["']$/g, '') || '';
        if (rawText.length > 5) {
          return {
            nextQuestion: rawText,
            isComplete: false,
            confidenceScore: 70,
          };
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
