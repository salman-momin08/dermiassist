import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

/**
 * Upstash Redis client for DermiAssist
 * 
 * This client is configured to work with Vercel's serverless environment
 * and provides automatic connection pooling and error handling.
 */

// Initialize Redis client with environment variables
export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    retry: {
        retries: 5,
        backoff: (retryCount) => Math.exp(retryCount) * 50,
    },
});

/**
 * Check if Redis is properly configured
 */
export function isRedisConfigured(): boolean {
    return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Test Redis connection
 * @returns Promise<boolean> - true if connection successful
 */
export async function testRedisConnection(): Promise<boolean> {
    if (!isRedisConfigured()) {
        logger.warn('Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env');
        return false;
    }

    try {
        await redis.ping();
        logger.info('✅ Redis connection successful');
        return true;
    } catch (error) {
        logger.error('❌ Redis connection failed:', error);
        return false;
    }
}

/**
 * Gracefully handle Redis errors
 * If Redis is down, operations will fail silently and fall back to database
 */
export async function safeRedisOperation<T>(
    operation: () => Promise<T>,
    fallback: T
): Promise<T> {
    if (!isRedisConfigured()) {
        return fallback;
    }

    try {
        return await operation();
    } catch (error) {
        logger.error('Redis operation failed, using fallback:', error);
        return fallback;
    }
}
