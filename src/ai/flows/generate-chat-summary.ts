
'use server';

/**
 * @fileOverview Generates a contextual chat reply based on a report and a follow-up question.
 *
 * - generateChatSummary - A function that answers a user's question about their report.
 * - GenerateChatSummaryInput - The input type for the function.
 * - GenerateChatSummaryOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateChatSummaryInputSchema = z.object({
  reportConditionName: z.string().describe('The name of the diagnosed skin condition from the report.'),
  reportRecommendations: z.string().describe('The detailed recommendations from the report.'),
  conversationHistory: z.string().describe('The history of the current conversation, for context.'),
  question: z.string().describe("The user's follow-up question."),
});
export type GenerateChatSummaryInput = z.infer<typeof GenerateChatSummaryInputSchema>;

const GenerateChatSummaryOutputSchema = z.object({
  answer: z.string().describe('A concise and helpful answer to the user\'s question based on the report context.'),
});
export type GenerateChatSummaryOutput = z.infer<typeof GenerateChatSummaryOutputSchema>;

export async function generateChatSummary(
  input: GenerateChatSummaryInput
): Promise<GenerateChatSummaryOutput> {
  return generateChatSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateChatSummaryPrompt',
  input: { schema: GenerateChatSummaryInputSchema },
  output: { schema: GenerateChatSummaryOutputSchema },
  prompt: `You are a helpful medical assistant AI. A user has a report about their skin condition, identified as **{{reportConditionName}}**.
The key recommendations in the report are: "{{reportRecommendations}}".

The user has a follow-up question. Based on the report details and the conversation history, provide a clear, concise, and reassuring answer to their question.
Do not provide new medical advice. Your answers should strictly be based on the information provided in the report recommendations.
If the question is outside the scope of the report, politely state that you cannot answer and recommend they speak to a doctor.

**Conversation History:**
{{{conversationHistory}}}

**User's New Question:**
"{{{question}}}"

Provide your answer now.`,
});

const generateChatSummaryFlow = ai.defineFlow(
  {
    name: 'generateChatSummaryFlow',
    inputSchema: GenerateChatSummaryInputSchema,
    outputSchema: GenerateChatSummaryOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
