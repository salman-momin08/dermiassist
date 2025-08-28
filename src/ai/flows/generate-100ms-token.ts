
'use server';
/**
 * @fileOverview A Genkit flow for generating a 100ms video call authentication token.
 *
 * - generate100msToken - A function that creates a token for a user to join a video call.
 * - Generate100msTokenInput - The input type for the generate100msToken function.
 * - Generate100msTokenOutput - The return type for the generate100msToken function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { AccessToken } from '@100mslive/server-sdk';

const Generate100msTokenInputSchema = z.object({
  userId: z.string().describe('The unique identifier for the user.'),
  role: z.string().describe("The user's role (e.g., 'patient', 'doctor')."),
});
export type Generate100msTokenInput = z.infer<
  typeof Generate100msTokenInputSchema
>;

const Generate100msTokenOutputSchema = z.object({
  token: z.string().describe('The generated authentication token.'),
});
export type Generate100msTokenOutput = z.infer<
  typeof Generate100msTokenOutputSchema
>;

export async function generate100msToken(
  input: Generate100msTokenInput
): Promise<Generate100msTokenOutput> {
  return generate100msTokenFlow(input);
}

const generate100msTokenFlow = ai.defineFlow(
  {
    name: 'generate100msTokenFlow',
    inputSchema: Generate100msTokenInputSchema,
    outputSchema: Generate100msTokenOutputSchema,
  },
  async (input) => {
    if (
      !process.env.NEXT_PUBLIC_100MS_ROOM_ID ||
      !process.env.NEXT_PUBLIC_100MS_APP_ACCESS_KEY ||
      !process.env.NEXT_PUBLIC_100MS_APP_SECRET
    ) {
      throw new Error('100ms environment variables are not configured.');
    }

    const accessToken = new AccessToken(
      process.env.NEXT_PUBLIC_100MS_APP_ACCESS_KEY,
      process.env.NEXT_PUBLIC_100MS_APP_SECRET
    );

    const token = await accessToken.sign({
      user_id: input.userId,
      role: input.role,
      room_id: process.env.NEXT_PUBLIC_100MS_ROOM_ID,
    });

    return { token };
  }
);
