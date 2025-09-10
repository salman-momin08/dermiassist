
'use server';

/**
 * @fileOverview A secure flow to generate an Agora video call token.
 *
 * - generateAgoraToken - A function that creates a time-limited token for a user and channel.
 * - GenerateAgoraTokenInput - The input type for the function.
 * - GenerateAgoraTokenOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

const GenerateAgoraTokenInputSchema = z.object({
  channelName: z.string().describe('The name of the channel to join.'),
  userId: z.string().describe("The user's unique ID."),
  role: z.enum(['publisher', 'subscriber']).describe("The user's role in the channel."),
});
export type GenerateAgoraTokenInput = z.infer<typeof GenerateAgoraTokenInputSchema>;

const GenerateAgoraTokenOutputSchema = z.object({
  token: z.string().describe('The generated authentication token.'),
});
export type GenerateAgoraTokenOutput = z.infer<typeof GenerateAgoraTokenOutputSchema>;

export async function generateAgoraToken(
  input: GenerateAgoraTokenInput
): Promise<GenerateAgoraTokenOutput> {
  return generateAgoraTokenFlow(input);
}

const generateAgoraTokenFlow = ai.defineFlow(
  {
    name: 'generateAgoraTokenFlow',
    inputSchema: GenerateAgoraTokenInputSchema,
    outputSchema: GenerateAgoraTokenOutputSchema,
  },
  async ({ channelName, userId, role }) => {
    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      throw new Error('Agora credentials are not configured on the server. Please check your .env file.');
    }

    const tokenRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const expirationTimeInSeconds = 3600; // Token valid for 1 hour
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      Number(userId) || 0, // Agora uses number or 0 for UIDs in token generation
      tokenRole,
      privilegeExpiredTs,
      privilegeExpiredTs,
    );

    return { token };
  }
);
