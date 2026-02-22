
import { NextRequest, NextResponse } from 'next/server';
import { StreamChat } from 'stream-chat';
import { createClient } from '@/lib/supabase/server';
import { RateLimitMiddleware } from '@/lib/redis/middleware';

export const dynamic = 'force-dynamic';

export const POST = RateLimitMiddleware.strict(async (request: NextRequest) => {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      console.error('Stream Token API: Missing userId');
      return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
    }

    if (user.id !== userId) {
      console.error(`Stream Token API: User ID mismatch. Auth: ${user.id}, Request: ${userId}`);
      return NextResponse.json({ message: 'Forbidden: Cannot request tokens for other users' }, { status: 403 });
    }

    const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('Stream Token API: Missing API credentials');
      return NextResponse.json({ message: 'Stream API key or secret is not configured' }, { status: 500 });
    }

    // Initialize server client
    const serverClient = StreamChat.getInstance(apiKey, apiSecret);

    // Lock the user metadata server-side so clients cannot impersonate names or roles
    await serverClient.upsertUser({
      id: userId,
      // The role here defaults to 'user', but can be explicitly set if passed safely.
      // We will stick to the default for now, as channel membership is the actual security barrier.
    });

    // Create a strict token that expires in exactly 1 hour
    const exp = Math.round(Date.now() / 1000) + (60 * 60);
    const token = serverClient.createToken(userId, exp);

    return NextResponse.json({ token });

  } catch (error: any) {
    console.error('Error creating Stream token:', error);
    // Be explicit about returning JSON even on crash
    return NextResponse.json({
      message: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? JSON.stringify(error) : undefined
    }, { status: 500 });
  }
});
