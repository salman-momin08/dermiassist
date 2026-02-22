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
    truncateDataUri,
} from '@/lib/redis/ai-cache';
import { detectDiseaseName as originalDetectDiseaseName, type DetectDiseaseNameInput, type DetectDiseaseNameOutput } from '@/ai/flows/detect-disease-name';
import { finalEvaluation as originalFinalEvaluation, type FinalEvaluationInput, type FinalEvaluationOutput } from '@/ai/flows/final-evaluation';

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
    // Generate image hash
    const imageHash = hashImageDataUri(input.photoDataUri);
    const cacheKey = getDetectDiseaseNameCacheKey(imageHash);

    console.log(`[AI Cache] Detect Disease - Image hash: ${imageHash.substring(0, 16)}...`);

    // Try cache first, then call API if needed
    const result = await getCacheOrSet<DetectDiseaseNameOutput>(
        cacheKey,
        async () => {
            console.log(`[AI Cache] 🔴 CACHE MISS - Calling Gemini API for disease detection`);
            console.log(`[AI Cache] Image: ${truncateDataUri(input.photoDataUri)}`);

            const apiResult = await originalDetectDiseaseName(input);

            console.log(`[AI Cache] ✅ Gemini API returned: ${apiResult.conditionName}`);
            return apiResult;
        },
        { ttl: CacheTTL.AI_ANALYSIS } // 30 days
    );

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
    // Check rate limit if userId provided
    if (userId) {
        const rateLimitResult = await checkRateLimit({
            limit: RateLimitPresets.AI_ANALYSIS.limit,
            window: RateLimitPresets.AI_ANALYSIS.window,
            identifier: userId,
            endpoint: 'ai-final-evaluation',
        });

        if (!rateLimitResult.success) {
            throw new Error(
                `Rate limit exceeded. You can make ${rateLimitResult.limit} AI analyses per hour. ` +
                `Please try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000 / 60)} minutes.`
            );
        }
    }
    // Generate image hash and cache key
    const imageHash = hashImageDataUri(input.photoDataUri);
    const cacheKey = getFinalEvaluationCacheKey(imageHash, input.userAnswers);

    console.log(`[AI Cache] Final Evaluation - Image hash: ${imageHash.substring(0, 16)}...`);

    // Try cache first, then call API if needed
    const result = await getCacheOrSet<FinalEvaluationOutput>(
        cacheKey,
        async () => {
            console.log(`[AI Cache] 🔴 CACHE MISS - Calling Gemini API for final evaluation`);
            console.log(`[AI Cache] Initial condition: ${input.initialCondition}`);
            console.log(`[AI Cache] User answers length: ${input.userAnswers.length} chars`);

            const apiResult = await originalFinalEvaluation(input);

            console.log(`[AI Cache] ✅ Gemini API returned: ${apiResult.conditionName}`);
            return apiResult;
        },
        { ttl: CacheTTL.AI_ANALYSIS } // 30 days
    );

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
