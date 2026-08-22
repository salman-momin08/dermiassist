import { NextRequest, NextResponse } from 'next/server';
import { RateLimitMiddleware } from '@/lib/redis/middleware';

/**
 * Test Rate Limiting API Endpoint
 * 
 * This endpoint demonstrates rate limiting in action.
 * Try making multiple requests to see the rate limit kick in.
 * 
 * Default limit: 100 requests per minute
 */

async function handler(req: NextRequest) {
    return NextResponse.json({
        success: true,
        message: 'Rate limit test successful',
        timestamp: new Date().toISOString(),
        tip: 'Check the X-RateLimit-* headers in the response',
    });
}

// Apply generous rate limiting (1000 requests/hour for testing)
export const GET = RateLimitMiddleware.generous(handler);
export const POST = RateLimitMiddleware.generous(handler);
