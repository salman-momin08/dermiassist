/**
 * Redis module exports
 * 
 * Centralized exports for all Redis functionality
 */

// Client
// Core Redis client and utilities
export { redis, isRedisConfigured, testRedisConnection } from './client';

// Generic cache operations
export {
    getCache,
    setCache,
    deleteCache,
    getCacheOrSet,
    getCacheMetrics,
    type CacheOptions,
} from './cache';

// Cache key generators and TTL constants
export {
    CacheKeys,
    CacheTTL,
} from './keys';

// AI-specific caching
export {
    hashImageDataUri,
    getDetectDiseaseNameCacheKey,
    getFinalEvaluationCacheKey,
    truncateDataUri,
} from './ai-cache';

// User profile caching
export {
    getCachedUserProfile,
    invalidateUserProfileCache,
    updateUserProfileWithCache,
    prefetchUserProfile,
} from './user-cache';

// Doctor listing caching
export {
    getCachedDoctorList,
    getCachedDoctorProfile,
    invalidateDoctorListCache,
    invalidateDoctorProfileCache,
} from './doctor-cache';

// Rate limiting
export {
    checkRateLimit,
    getRateLimitStatus,
    resetRateLimit,
    RateLimitPresets,
    type RateLimitConfig,
    type RateLimitResult,
} from './rate-limit';

// Rate limiting middleware
export {
    withRateLimit,
    RateLimitMiddleware,
    type RateLimitOptions,
} from './middleware';
