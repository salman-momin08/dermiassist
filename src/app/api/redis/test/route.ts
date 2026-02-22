import { NextResponse } from 'next/server';
import { testRedisConnection, redis, getCacheMetrics } from '@/lib/redis';

/**
 * Test endpoint for Redis connection and basic operations
 * 
 * GET /api/redis/test
 * 
 * This endpoint tests:
 * - Redis connection
 * - Basic set/get operations
 * - Cache metrics
 */
export async function GET() {
    try {
        // Test connection
        const isConnected = await testRedisConnection();

        if (!isConnected) {
            return NextResponse.json({
                success: false,
                message: 'Redis is not configured or connection failed',
                hint: 'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env'
            }, { status: 500 });
        }

        // Test basic operations
        const testKey = 'test:connection';
        const testValue = {
            message: 'Hello from DermiAssist Redis!',
            timestamp: new Date().toISOString(),
        };

        // Set a test value
        await redis.set(testKey, JSON.stringify(testValue));

        // Get it back
        const retrieved = await redis.get(testKey);
        const parsedValue = typeof retrieved === 'string' ? JSON.parse(retrieved) : retrieved;

        // Clean up
        await redis.del(testKey);

        // Get cache metrics
        const metrics = getCacheMetrics();

        return NextResponse.json({
            success: true,
            message: 'Redis is working correctly! ✅',
            test: {
                written: testValue,
                retrieved: parsedValue,
                match: JSON.stringify(testValue) === JSON.stringify(parsedValue),
            },
            metrics: {
                hits: metrics.hits,
                misses: metrics.misses,
                hitRate: `${metrics.hitRate.toFixed(2)}%`,
            },
            info: {
                provider: 'Upstash Redis',
                serverless: true,
            }
        });

    } catch (error: any) {
        console.error('Redis test failed:', error);
        return NextResponse.json({
            success: false,
            message: 'Redis test failed',
            error: error.message,
        }, { status: 500 });
    }
}
