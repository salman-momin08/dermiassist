
import { NextResponse } from 'next/server';
import { AccessToken } from '@100mslive/server-sdk';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { roomId, role, userId } = await request.json();

    if (!process.env.HMS_ACCESS_KEY || !process.env.HMS_SECRET) {
        throw new Error('HMS Access Key or Secret is not configured on the server.');
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
    
    return NextResponse.json({ token });

  } catch (error) {
    console.error('Error in generate-token endpoint:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to process token request', details: errorMessage }, { status: 500 });
  }
}
