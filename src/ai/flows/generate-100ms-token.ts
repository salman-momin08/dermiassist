
'use server';

/**
 * @fileOverview A secure flow to generate a 100ms video call token.
 *
 * - generate100msToken - A function that creates a time-limited token for a user and room.
 * - Generate100msTokenInput - The input type for the generate100msToken function.
 * - Generate100msTokenOutput - The return type for the generate100msToken function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { AccessToken } from '@100mslive/server-sdk';

const Generate100msTokenInputSchema = z.object({
  roomId: z.string().describe('The ID of the 100ms room.'),
  role: z.string().describe("The user's role (e.g., patient, doctor)."),
  userId: z.string().describe("The user's unique ID."),
});
export type Generate100msTokenInput = z.infer<typeof Generate100msTokenInputSchema>;

const Generate100msTokenOutputSchema = z.object({
  token: z.string().describe('The generated authentication token.'),
});
export type Generate100msTokenOutput = z.infer<typeof Generate100msTokenOutputSchema>;

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
  async ({ roomId, role, userId }) => {
    if (!process.env.HMS_ACCESS_KEY || !process.env.HMS_SECRET) {
      throw new Error('HMS credentials are not configured on the server.');
    }

    const accessToken = new AccessToken(
      process.env.HMS_ACCESS_KEY,
      process.env.HMS_SECRET
    );

    const token = await accessToken.createToken({
      roomId: roomId,
      role: role,
      userId: userId,
      // Token is valid for 24 hours
      expiresIn: 24 * 60 * 60,
    });

    return { token };
  }
);
