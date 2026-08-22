'use server';

/**
 * User Profile Caching Utilities
 * 
 * Functions to cache user profiles and reduce Supabase database queries
 */

import { createClient } from '@/lib/supabase/server';
import { getCacheOrSet, setCache, deleteCache, CacheKeys, CacheTTL } from '@/lib/redis';
import { withRetry, isNetworkError } from '@/lib/utils/retry';
import { logger } from '@/lib/logger';

export interface UserProfile {
    id: string;
    email: string;
    display_name: string | null;
    role: 'patient' | 'doctor' | 'admin';
    subscription_plan?: string;
    created_at: string;
    updated_at: string;
    [key: string]: any;
}

/**
 * Get user profile with caching
 * Checks Redis first, falls back to Supabase if not cached
 * 
 * @param userId - User ID
 * @returns User profile or null
 */
export async function getCachedUserProfile(userId: string): Promise<UserProfile | null> {
    const cacheKey = CacheKeys.userProfile(userId);

    try {
        const profile = await getCacheOrSet<UserProfile | null>(
            cacheKey,
            async () => {
                return await withRetry(async () => {
                    const supabase = await createClient();
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', userId)
                        .single();

                    if (error) {
                        if (isNetworkError(error)) {
                            logger.warn(`[User Cache] Network error fetching profile for ${userId}, retrying...`, error.message);
                            throw error; // Trigger retry
                        }
                        logger.error(`[User Cache] Error fetching profile:`, error);
                        return null;
                    }

                    return data as UserProfile;
                }, {
                    retries: 2,
                    delay: 1000,
                    shouldRetry: isNetworkError
                });
            },
            { ttl: CacheTTL.USER_PROFILE } // 1 hour
        );

        return profile;
    } catch (error) {
        logger.error('[User Cache] Failed to get user profile:', error);
        return null;
    }
}

/**
 * Invalidate user profile cache
 * Call this when user updates their profile
 * 
 * @param userId - User ID
 */
export async function invalidateUserProfileCache(userId: string): Promise<void> {
    const cacheKey = CacheKeys.userProfile(userId);
    await deleteCache(cacheKey);
}

/**
 * Update user profile and invalidate cache
 * Helper function to update profile and clear cache in one call
 * 
 * @param userId - User ID
 * @param updates - Profile fields to update
 */
export async function updateUserProfileWithCache(
    userId: string,
    updates: Partial<UserProfile>
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId);

        if (error) {
            console.error(`[User Cache] Update failed:`, error);
            return { success: false, error: error.message };
        }

        // Invalidate cache so next fetch gets fresh data
        await invalidateUserProfileCache(userId);
        return { success: true };
    } catch (error: any) {
        console.error(`[User Cache] Unexpected error:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Prefetch and cache user profile
 * Useful for warming cache before user needs it
 * 
 * @param userId - User ID
 */
export async function prefetchUserProfile(userId: string): Promise<void> {
    await getCachedUserProfile(userId);
}
