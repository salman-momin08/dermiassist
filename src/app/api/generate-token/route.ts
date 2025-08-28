
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { roomId, role, userId } = await request.json();

    // The @100mslive/server-sdk package is causing installation issues.
    // This API route is now a placeholder and will return an error until a stable solution is found.
    const errorMessage = 'The video service is temporarily unavailable due to a configuration issue with the token generation service.';
    
    console.error(errorMessage, { roomId, role, userId });

    return NextResponse.json(
      { error: errorMessage },
      { status: 503 } // Service Unavailable
    );

  } catch (error) {
    console.error('Error in generate-token endpoint:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to process token request', details: errorMessage }, { status: 500 });
  }
}
