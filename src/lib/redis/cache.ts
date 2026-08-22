import { redis, safeRedisOperation, isRedisConfigured } from './client';
import { CacheTTL } from './keys';

/**
 * Generic cache utility functions for DermiAssist
 * 
 * These functions provide a simple interface for caching data with
 * automatic serialization, TTL management, and error handling.
 */

export interface CacheOptions {
    ttl?: number;  // Time to live in seconds
    tags?: string[]; // Tags for cache invalidation
}

/**
 * Get a value from cache
 * @param key - Cache key
 * @returns Cached value or null if not found
 */
export async function getCache<T>(key: string): Promise<T | null> {
    return safeRedisOperation(async () => {
        const value = await redis.get(key);
        if (!value) return null;

        // If value is already an object, return it directly
        if (typeof value === 'object') return value as T;

        // Otherwise try to parse it
        try {
            return JSON.parse(value as string) as T;
        } catch {
            return value as T;
        }
    }, null);
}

/**
 * Set a value in cache
 * @param key - Cache key
 * @param value - Value to cache
 * @param options - Cache options (TTL, tags)
 */
export async function setCache<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
): Promise<boolean> {
    const { ttl = CacheTTL.HOUR } = options;

    return safeRedisOperation(async () => {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);

        if (ttl) {
            await redis.setex(key, ttl, serialized);
        } else {
            await redis.set(key, serialized);
        }

        return true;
    }, false);
}

/**
 * Delete a value from cache
 * @param key - Cache key or pattern
 */
export async function deleteCache(key: string): Promise<boolean> {
    return safeRedisOperation(async () => {
        await redis.del(key);
        return true;
    }, false);
}

/**
 * Delete multiple keys matching a pattern
 * @param pattern - Pattern with wildcards (e.g., "user:*:profile")
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
    if (!isRedisConfigured()) return 0;

    try {
        // Note: Upstash Redis doesn't support SCAN, so we need to track keys manually
        // For now, we'll use a simple approach with known keys
        console.warn(`Pattern deletion not fully supported in Upstash. Pattern: ${pattern}`);
        return 0;
    } catch (error) {
        console.error('Failed to delete cache pattern:', error);
        return 0;
    }
}

/**
 * Check if a key exists in cache
 * @param key - Cache key
 */
export async function hasCache(key: string): Promise<boolean> {
    return safeRedisOperation(async () => {
        const exists = await redis.exists(key);
        return exists === 1;
    }, false);
}

/**
 * Get remaining TTL for a key
 * @param key - Cache key
 * @returns TTL in seconds, or -1 if key doesn't exist, -2 if no TTL
 */
export async function getCacheTTL(key: string): Promise<number> {
    return safeRedisOperation(async () => {
        return await redis.ttl(key);
    }, -1);
}

/**
 * Increment a counter in cache
 * @param key - Cache key
 * @param amount - Amount to increment (default: 1)
 * @returns New value after increment
 */
export async function incrementCache(key: string, amount: number = 1): Promise<number> {
    return safeRedisOperation(async () => {
        return await redis.incrby(key, amount);
    }, 0);
}

/**
 * Get or set pattern: Get from cache, or compute and cache if not found
 * @param key - Cache key
 * @param fetcher - Function to fetch data if not in cache
 * @param options - Cache options
 */
export async function getCacheOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
): Promise<T> {
    const { ttl = 3600 } = options;
    let cached: T | null = null;

    try {
        // Try to get from cache
        cached = await getCache<T>(key);
    } catch (error) {
        console.warn('Cache retrieval failed, skipping cache:', error);
        // Continue to fetch fresh data
    }

    if (cached !== null) {
        return cached;
    }

    // Cache miss or cache error - fetch fresh data
    // If this throws, we let it bubble up instead of catching and retrying
    const data = await fetchFn();

    // Store in cache (don't await to avoid blocking)
    setCache(key, data, { ttl }).catch(err => {
        console.error('Background cache set failed:', err);
    });

    return data;
}

/**
 * Cache metrics tracking
 */
export interface CacheMetrics {
    hits: number;
    misses: number;
    hitRate: number;
}

let cacheHits = 0;
let cacheMisses = 0;

export function trackCacheHit() {
    cacheHits++;
}

export function trackCacheMiss() {
    cacheMisses++;
}

export function getCacheMetrics(): CacheMetrics {
    const total = cacheHits + cacheMisses;
    return {
        hits: cacheHits,
        misses: cacheMisses,
        hitRate: total > 0 ? (cacheHits / total) * 100 : 0,
    };
}

export function resetCacheMetrics() {
    cacheHits = 0;
    cacheMisses = 0;
}
