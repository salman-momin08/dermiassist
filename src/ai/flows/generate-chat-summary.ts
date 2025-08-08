
'use server';

/**
 * @fileOverview Generates a summary of a chat conversation.
 *
 * - generateChatSummary - A function that creates a summary of a conversation history.
 * - GenerateChatSummaryInput - The input type for the generateChatSummary function.
 * - GenerateChatSummaryOutput - The return type for the generateChatSummary function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateChatSummaryInputSchema = z.object({
  patientName: z.string().describe("The patient's name."),
  conversationHistory: z
    .string()
    .describe('The entire conversation history, with each message on a new line.'),
});
type GenerateChatSummaryInput = z.infer<
  typeof GenerateChatSummaryInputSchema
>;

const GenerateChatSummaryOutputSchema = z.object({
  summary: z
    .string()
    .describe('A concise, bullet-pointed summary of the conversation.'),
});
type GenerateChatSummaryOutput = z.infer<
  typeof GenerateChatSummaryOutputSchema
>;

export async function generateChatSummary(
  input: GenerateChatSummaryInput
): Promise<AsyncGenerator<GenerateChatSummaryOutput>> {
  return generateChatSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateChatSummaryPrompt',
  input: { schema: GenerateChatSummaryInputSchema },
  output: { schema: GenerateChatSummaryOutputSchema },
  prompt: `You are an AI medical assistant. Your task is to summarize the conversation between a doctor and a patient named {{{patientName}}}.

Provide a brief, bullet-pointed summary of the key points, questions, and outcomes from the following conversation history.

Conversation:
{{{conversationHistory}}}
`,
});

const generateChatSummaryFlow = ai.defineFlow(
  {
    name: 'generateChatSummaryFlow',
    inputSchema: GenerateChatSummaryInputSchema,
    outputSchema: z.string(),
  },
  async function* (input) {
    const { stream } = ai.generateStream({
      prompt: prompt.template,
      input,
      output: {
        schema: GenerateChatSummaryOutputSchema,
      },
    });

    for await (const chunk of stream) {
      if (chunk.output) {
        yield chunk.output;
      }
    }
  }
);
