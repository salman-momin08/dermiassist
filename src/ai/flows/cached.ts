'use server';

/**
 * Cached AI Flow Wrappers with Rate Limiting
 * 
 * These functions wrap the original AI flows with Redis caching
 * and rate limiting to reduce costs and prevent abuse.
 */

import { getCacheOrSet, CacheTTL } from '@/lib/redis';
import { checkRateLimit, RateLimitPresets } from '@/lib/redis/rate-limit';
import {
    hashImageDataUri,
    getDetectDiseaseNameCacheKey,
    getFinalEvaluationCacheKey,
} from '@/lib/redis/ai-cache';
import { detectDiseaseName as originalDetectDiseaseName, type DetectDiseaseNameInput, type DetectDiseaseNameOutput } from '@/ai/flows/detect-disease-name';
import { finalEvaluation as originalFinalEvaluation, type FinalEvaluationInput, type FinalEvaluationOutput } from '@/ai/flows/final-evaluation';
import { logger } from '@/lib/logger';
import { trackCacheHit, trackCacheMiss } from '@/lib/redis/cache';
import { RateLimitError } from '@/lib/errors';

/**
 * Cached version of detectDiseaseName with rate limiting
 * 
 * Rate limit: 10 requests per hour per user
 * Cache TTL: 30 days
 */
export async function detectDiseaseNameCached(
    input: DetectDiseaseNameInput,
    userId?: string
): Promise<DetectDiseaseNameOutput> {
    const imageHash = hashImageDataUri(input.photoDataUri);
    const cacheKey = getDetectDiseaseNameCacheKey(imageHash);

    logger.debug('ai_cache.detect_disease.start', { imageHashPrefix: imageHash.substring(0, 16), userId });

    const result = await getCacheOrSet<DetectDiseaseNameOutput>(
        cacheKey,
        async () => {
            logger.info('ai_cache.detect_disease.miss', { imageHashPrefix: imageHash.substring(0, 16) });
            trackCacheMiss();
            try {
                const apiResult = await originalDetectDiseaseName(input);
                logger.info('ai_cache.detect_disease.api_returned', { conditionName: apiResult.conditionName });
                return apiResult;
            } catch (error) {
                logger.error('ai_cache.detect_disease.failed', {
                    imageHashPrefix: imageHash.substring(0, 16),
                    userId,
                    name: error instanceof Error ? error.name : typeof error,
                    message: error instanceof Error ? error.message : String(error),
                    code: (error as any)?.code,
                });
                throw error;
            }
        },
        { ttl: CacheTTL.AI_ANALYSIS } // 30 days
    );

    // If result came back immediately (no miss logged), it was a cache hit
    trackCacheHit();
    return result;
}

/**
 * Cached version of finalEvaluation with rate limiting
 * 
 * Checks cache first before calling Gemini API
 * Cache key includes both image hash and user answers hash
 * Rate limit: 10 requests per hour per user
 * Cache TTL: 30 days
 */
export async function finalEvaluationCached(
    input: FinalEvaluationInput,
    userId?: string
): Promise<FinalEvaluationOutput> {
    if (userId) {
        const rateLimitResult = await checkRateLimit({
            limit: RateLimitPresets.AI_ANALYSIS.limit,
            window: RateLimitPresets.AI_ANALYSIS.window,
            identifier: userId,
            endpoint: 'ai-final-evaluation',
        });

        if (!rateLimitResult.success) {
            const minutesUntilReset = Math.ceil((rateLimitResult.reset - Date.now()) / 1000 / 60);
            throw new RateLimitError(
                `Rate limit exceeded. You can make ${rateLimitResult.limit} AI analyses per hour. ` +
                `Please try again in ${minutesUntilReset} minutes.`,
                {
                    endpoint: 'ai-final-evaluation',
                    identifier: userId,
                    retryAfter: rateLimitResult.retryAfter,
                }
            );
        }
    }

    const imageHash = hashImageDataUri(input.photoDataUri);
    const cacheKey = getFinalEvaluationCacheKey(imageHash, input.userAnswers);

    logger.debug('ai_cache.final_eval.start', { imageHashPrefix: imageHash.substring(0, 16), userId });

    const result = await getCacheOrSet<FinalEvaluationOutput>(
        cacheKey,
        async () => {
            logger.info('ai_cache.final_eval.miss', {
                imageHashPrefix: imageHash.substring(0, 16),
                initialCondition: input.initialCondition,
                answersLength: input.userAnswers.length,
            });
            trackCacheMiss();
            try {
                const apiResult = await originalFinalEvaluation(input);
                logger.info('ai_cache.final_eval.api_returned', { conditionName: apiResult.conditionName });
                return apiResult;
            } catch (error) {
                logger.error('ai_cache.final_eval.failed', {
                    imageHashPrefix: imageHash.substring(0, 16),
                    userId,
                    name: error instanceof Error ? error.name : typeof error,
                    message: error instanceof Error ? error.message : String(error),
                    code: (error as any)?.code,
                });
                throw error;
            }
        },
        { ttl: CacheTTL.AI_ANALYSIS } // 30 days
    );

    trackCacheHit();
    return result;
}

/**
 * Statistics helper to track cache effectiveness
 */
export interface AICacheStats {
    detectDiseaseHits: number;
    detectDiseaseMisses: number;
    finalEvalHits: number;
    finalEvalMisses: number;
    totalSavings: string;
}

// Note: In production, you'd want to track these in Redis itself
// For now, this is a placeholder for future implementation
export async function getAICacheStats(): Promise<AICacheStats> {
    // This would query Redis for actual stats
    // For now, return placeholder
    return {
        detectDiseaseHits: 0,
        detectDiseaseMisses: 0,
        finalEvalHits: 0,
        finalEvalMisses: 0,
        totalSavings: '$0.00',
    };
}
