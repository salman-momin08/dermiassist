import { redis, isRedisConfigured } from './client';
import { logger } from '@/lib/logger';

/**
 * Rate Limiting Utilities
 * 
 * Implements sliding window rate limiting using Redis
 * to protect API endpoints from abuse and control costs.
 */

export interface RateLimitConfig {
    limit: number;        // Maximum requests allowed
    window: number;       // Time window in seconds
    identifier: string;   // Unique identifier (userId, IP, etc.)
    endpoint: string;     // Endpoint being rate limited
}

export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;        // Timestamp when limit resets
    retryAfter?: number;  // Seconds until can retry (if limited)
}

/**
 * Check rate limit for a request
 * Uses sliding window algorithm with Redis
 * 
 * @param config - Rate limit configuration
 * @returns Rate limit result with remaining requests
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    const { limit, window, identifier, endpoint } = config;

    // If Redis not configured, allow all requests (graceful degradation)
    if (!isRedisConfigured()) {
        logger.warn('[Rate Limit] Redis not configured, allowing request');
        return {
            success: true,
            limit,
            remaining: limit,
            reset: Date.now() + window * 1000,
        };
    }

    const key = `ratelimit:${endpoint}:${identifier}`;
    const now = Date.now();
    const windowStart = now - window * 1000;

    try {
        // Use Redis pipeline for atomic operations
        const pipeline = redis.pipeline();

        // Remove old entries outside the window
        pipeline.zremrangebyscore(key, 0, windowStart);

        // Count requests in current window
        pipeline.zcard(key);

        // Add current request with score (timestamp) and member (unique ID)
        pipeline.zadd(key, { score: now, member: `${now}-${Math.random()}` });

        // Set expiry on the key
        pipeline.expire(key, window);

        const results = await pipeline.exec() as Array<[Error | null, any]> | null;

        // Extract count from results (index 1 is zcard result)
        // Pipeline results format: [[error, result], [error, result], ...]
        const count = (results && results[1] && typeof results[1][1] === 'number') ? results[1][1] : 0;
        const remaining = Math.max(0, limit - count - 1);
        const reset = now + window * 1000;

        if (count >= limit) {
            logger.info(`[Rate Limit] ❌ LIMIT EXCEEDED - ${endpoint} for ${identifier.substring(0, 8)}... (${count}/${limit})`);

            return {
                success: false,
                limit,
                remaining: 0,
                reset,
                retryAfter: Math.ceil(window),
            };
        }

        logger.info(`[Rate Limit] ✅ ALLOWED - ${endpoint} for ${identifier.substring(0, 8)}... (${count + 1}/${limit})`);

        return {
            success: true,
            limit,
            remaining,
            reset,
        };
    } catch (error) {
        logger.error('[Rate Limit] Error checking rate limit:', error);

        // On error, allow request (fail open for better UX)
        return {
            success: true,
            limit,
            remaining: limit,
            reset: now + window * 1000,
        };
    }
}

/**
 * Preset rate limit configurations for common use cases
 */
export const RateLimitPresets = {
    // AI Analysis: 10 requests per hour per user
    AI_ANALYSIS: {
        limit: 10,
        window: 3600, // 1 hour
    },

    // File Upload: 20 uploads per hour per user
    FILE_UPLOAD: {
        limit: 20,
        window: 3600,
    },

    // API Endpoints: 100 requests per minute per user
    API_DEFAULT: {
        limit: 100,
        window: 60,
    },

    // Strict: 5 requests per minute (for sensitive operations)
    STRICT: {
        limit: 5,
        window: 60,
    },

    // Generous: 1000 requests per hour (for read operations)
    GENEROUS: {
        limit: 1000,
        window: 3600,
    },
} as const;

/**
 * Get rate limit info without incrementing counter
 * Useful for checking current status
 * 
 * @param identifier - Unique identifier
 * @param endpoint - Endpoint name
 * @param limit - Maximum requests
 * @param window - Time window in seconds
 */
export async function getRateLimitStatus(
    identifier: string,
    endpoint: string,
    limit: number,
    window: number
): Promise<Omit<RateLimitResult, 'success'>> {
    if (!isRedisConfigured()) {
        return {
            limit,
            remaining: limit,
            reset: Date.now() + window * 1000,
        };
    }

    const key = `ratelimit:${endpoint}:${identifier}`;
    const now = Date.now();
    const windowStart = now - window * 1000;

    try {
        // Remove old entries
        await redis.zremrangebyscore(key, 0, windowStart);

        // Count current requests
        const count = await redis.zcard(key);
        const remaining = Math.max(0, limit - count);
        const reset = now + window * 1000;

        return {
            limit,
            remaining,
            reset,
            retryAfter: remaining === 0 ? Math.ceil(window) : undefined,
        };
    } catch (error) {
        console.error('[Rate Limit] Error getting status:', error);
        return {
            limit,
            remaining: limit,
            reset: now + window * 1000,
        };
    }
}

/**
 * Reset rate limit for a specific identifier
 * Useful for admin overrides or testing
 * 
 * @param identifier - Unique identifier
 * @param endpoint - Endpoint name
 */
export async function resetRateLimit(
    identifier: string,
    endpoint: string
): Promise<boolean> {
    if (!isRedisConfigured()) {
        return true;
    }

    const key = `ratelimit:${endpoint}:${identifier}`;

    try {
        await redis.del(key);
        console.log(`[Rate Limit] 🔄 Reset limit for ${endpoint}:${identifier.substring(0, 8)}...`);
        return true;
    } catch (error) {
        console.error('[Rate Limit] Error resetting limit:', error);
        return false;
    }
}
