
'use server';
/**
 * @fileOverview A Genkit flow for generating a 100ms authentication token.
 *
 * - generate100msToken - A function that creates an auth token for a user to join a video call.
 * - Generate100msTokenInput - The input type for the generate100msToken function.
 * - Generate100msTokenOutput - The return type for the generate100msToken function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { HMS } from '@100mslive/server-sdk';

const Generate100msTokenInputSchema = z.object({
  userId: z.string().describe('The unique identifier for the user.'),
  role: z.enum(['doctor', 'patient']).describe('The role of the user in the call.'),
});
export type Generate100msTokenInput = z.infer<typeof Generate100msTokenInputSchema>;

const Generate100msTokenOutputSchema = z.object({
  token: z.string().describe('The generated authentication token for the 100ms video call.'),
});
export type Generate100msTokenOutput = z.infer<typeof Generate100msTokenOutputSchema>;

export async function generate100msToken(input: Generate100msTokenInput): Promise<Generate100msTokenOutput> {
  return generate100msTokenFlow(input);
}

const generate100msTokenFlow = ai.defineFlow(
  {
    name: 'generate100msTokenFlow',
    inputSchema: Generate100msTokenInputSchema,
    outputSchema: Generate100msTokenOutputSchema,
  },
  async ({ userId, role }) => {
    const accessKey = process.env.NEXT_PUBLIC_100MS_APP_ACCESS_KEY;
    const appSecret = process.env.NEXT_PUBLIC_100MS_APP_SECRET;
    const roomId = process.env.NEXT_PUBLIC_100MS_ROOM_ID;

    if (!accessKey || !appSecret || !roomId) {
      throw new Error('100ms environment variables are not set.');
    }

    const hms = new HMS(accessKey, appSecret);

    try {
      const token = await hms.auth.createAppToken({
        userId,
        roomId,
        role,
      });
      return { token };
    } catch (error) {
      console.error('Error generating 100ms token:', error);
      throw new Error('Failed to generate 100ms token.');
    }
  }
);
