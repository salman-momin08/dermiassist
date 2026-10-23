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
    unavailable?: boolean;
}

const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
local allowed = 0
if count < limit then
    redis.call('ZADD', key, now, ARGV[4])
    redis.call('PEXPIRE', key, window)
    count = count + 1
    allowed = 1
end
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local reset = now + window
if #oldest > 0 then reset = tonumber(oldest[2]) + window end
return {allowed, count, reset}
`;

/**
 * Check rate limit for a request
 * Uses sliding window algorithm with Redis
 * 
 * @param config - Rate limit configuration
 * @returns Rate limit result with remaining requests
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    const { limit, window, identifier, endpoint } = config;

    const unavailable: RateLimitResult = {
        success: false, unavailable: true, limit, remaining: 0,
        reset: Date.now() + 60000, retryAfter: 60,
    };
    if (!isRedisConfigured()) {
        logger.error('[Rate Limit] Redis not configured; refusing unmetered requests');
        return unavailable;
    }

    const key = `ratelimit:${endpoint}:${identifier}`;
    const now = Date.now();
    try {
        const result = await redis.eval<[number, number, number, string], [number, number, number]>(
            SLIDING_WINDOW_SCRIPT, [key], [now, window * 1000, limit, crypto.randomUUID()]
        );
        if (!Array.isArray(result) || result.length !== 3 || !result.every(Number.isFinite)
            || (result[0] !== 0 && result[0] !== 1) || result[1] < 0 || result[2] < now) {
            throw new Error('Invalid rate-limit response from Redis');
        }
        const [allowed, count, reset] = result;
        return {
            success: allowed === 1,
            limit,
            remaining: Math.max(0, limit - count),
            reset,
            ...(allowed === 0 ? { retryAfter: Math.max(1, Math.ceil((reset - now) / 1000)) } : {}),
        };
    } catch (error) {
        logger.error('[Rate Limit] Error checking rate limit:', error);

        return unavailable;
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
