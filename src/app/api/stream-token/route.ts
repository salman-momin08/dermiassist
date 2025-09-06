
import { NextRequest, NextResponse } from 'next/server';
import { StreamChat } from 'stream-chat';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error("Stream API key or secret is not set.");
      return NextResponse.json({ message: 'Chat service is not configured on the server.' }, { status: 500 });
    }

    // Initialize Stream Chat server client
    const serverClient = StreamChat.getInstance(apiKey, apiSecret);
    
    // Create a token for the user
    const token = serverClient.createToken(userId);

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error creating Stream token:', error);
    return NextResponse.json({ message: 'Error creating chat token.' }, { status: 500 });
  }
}
