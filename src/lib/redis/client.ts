import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

/**
 * Upstash Redis client for DermiAssist
 *
 * This client is configured to work with Vercel's serverless environment
 * and provides automatic connection pooling and error handling.
 *
 * Includes a circuit breaker that disables Redis for a cooldown period
 * after repeated failures — prevents slow timeouts from blocking every request.
 */

// Initialize Redis client with environment variables
export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    retry: {
        retries: 2,          // reduced from 5 — fail fast
        backoff: (retryCount) => Math.min(retryCount * 100, 1000),
    },
});

// ── Circuit breaker state ──────────────────────────────────────────────
// After CIRCUIT_BREAKER_THRESHOLD consecutive failures, Redis operations
// are skipped entirely for CIRCUIT_BREAKER_COOLDOWN_MS.  This avoids the
// pattern where every request blocks for 10+ seconds waiting for timeout.

const CIRCUIT_BREAKER_THRESHOLD = 3;       // failures before tripping
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000; // 1 minute cooldown

let consecutiveFailures = 0;
let circuitOpenUntil = 0;                  // timestamp (ms)

function isCircuitOpen(): boolean {
    if (circuitOpenUntil === 0) return false;
    if (Date.now() >= circuitOpenUntil) {
        // Cooldown expired → half-open: allow one try
        circuitOpenUntil = 0;
        consecutiveFailures = 0;
        logger.info('[Redis] Circuit breaker reset — retrying Redis');
        return false;
    }
    return true;
}

function recordSuccess() {
    consecutiveFailures = 0;
    circuitOpenUntil = 0;
}

function recordFailure() {
    consecutiveFailures++;
    if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
        logger.warn(
            `[Redis] Circuit breaker OPEN — skipping Redis for ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s after ${consecutiveFailures} failures`
        );
    }
}

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
        recordSuccess();
        return true;
    } catch (error) {
        logger.error('❌ Redis connection failed:', error);
        recordFailure();
        return false;
    }
}

/**
 * Gracefully handle Redis errors with circuit breaker
 * If Redis is down, operations will fail silently and fall back to database
 */
export async function safeRedisOperation<T>(
    operation: () => Promise<T>,
    fallback: T
): Promise<T> {
    if (!isRedisConfigured() || isCircuitOpen()) {
        return fallback;
    }

    try {
        const result = await operation();
        recordSuccess();
        return result;
    } catch (error) {
        recordFailure();
        // Only log at warn level — the error trace is too noisy for expected timeouts
        logger.warn('[Redis] Operation failed, using fallback');
        return fallback;
    }
}
