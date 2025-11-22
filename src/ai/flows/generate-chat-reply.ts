
'use server';

/**
 * @fileOverview Generates contextual chat replies for a doctor.
 *
 * - generateChatReply - A function that suggests replies based on conversation context.
 * - GenerateChatReplyInput - The input type for the generateChatReply function.
 * - GenerateChatReplyOutput - The return type for the generateChatReply function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateChatReplyInputSchema = z.object({
  patientName: z.string().describe("The patient's name."),
  conversationHistory: z
    .string()
    .describe('The recent history of the conversation.'),
  lastPatientMessage: z.string().describe("The patient's most recent message."),
});
export type GenerateChatReplyInput = z.infer<
  typeof GenerateChatReplyInputSchema
>;

const GenerateChatReplyOutputSchema = z.object({
  replies: z
    .array(z.string())
    .describe('An array of 2-3 suggested, concise replies.'),
});
export type GenerateChatReplyOutput = z.infer<
  typeof GenerateChatReplyOutputSchema
>;

export async function generateChatReply(
  input: GenerateChatReplyInput
): Promise<GenerateChatReplyOutput> {
  return generateChatReplyFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateChatReplyPrompt',
  input: { schema: GenerateChatReplyInputSchema },
  output: { schema: GenerateChatReplyOutputSchema },
  prompt: `You are an AI assistant for a dermatologist. Your task is to generate 2-3 concise, professional, and empathetic reply suggestions for the doctor based on the patient's latest message.

The doctor is talking to {{{patientName}}}.

Here is the recent conversation history:
{{{conversationHistory}}}

The patient, {{{patientName}}}, just sent this message:
"{{{lastPatientMessage}}}"

Generate 2-3 appropriate, short replies that the doctor can use. The tone should be helpful and professional. Do not ask more than one question in a single reply.
`,
});

const generateChatReplyFlow = ai.defineFlow(
  {
    name: 'generateChatReplyFlow',
    inputSchema: GenerateChatReplyInputSchema,
    outputSchema: GenerateChatReplyOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
