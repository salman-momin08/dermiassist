'use server';

/**
 * Doctor Listing Cache Utilities
 * 
 * Functions to cache doctor listings and reduce database queries
 */

import { createClient } from '@/lib/supabase/server';
import { getCacheOrSet, deleteCache, CacheKeys, CacheTTL } from '@/lib/redis';
import { withRetry, isNetworkError } from '@/lib/utils/retry';
import type { UserProfile } from './user-cache';
import { logger } from '@/lib/logger';

export interface DoctorProfile extends UserProfile {
    role: 'doctor';
    specialization?: string;
    experience_years?: number;
    consultation_fee?: number;
    availability?: any;
    verified?: boolean;
}

export interface DoctorListFilters {
    specialization?: string;
    verified?: boolean;
    minFee?: number;
    maxFee?: number;
    search?: string;
}

/**
 * Generate cache key for doctor list based on filters
 */
function getDoctorListCacheKey(filters?: DoctorListFilters): string {
    if (!filters || Object.keys(filters).length === 0) {
        return CacheKeys.doctorList();
    }

    // Create a stable string from filters for cache key
    const filterString = JSON.stringify(filters, Object.keys(filters).sort());
    return CacheKeys.doctorList(filterString);
}

/**
 * Get cached doctor listings
 * 
 * @param filters - Optional filters for doctor search
 * @returns Array of doctor profiles
 */
export async function getCachedDoctorList(
    filters?: DoctorListFilters
): Promise<DoctorProfile[]> {
    const cacheKey = getDoctorListCacheKey(filters);

    try {
        const doctors = await getCacheOrSet<DoctorProfile[]>(
            cacheKey,
            async () => {
                return await withRetry(async () => {
                    const supabase = await createClient();
                    let query = supabase
                        .from('profiles')
                        .select('*')
                        .eq('role', 'doctor');

                    // Apply filters
                    if (filters?.specialization) {
                        query = query.eq('specialization', filters.specialization);
                    }
                    if (filters?.verified !== undefined) {
                        query = query.eq('verified', filters.verified);
                    }
                    if (filters?.minFee) {
                        query = query.gte('consultation_fee', filters.minFee);
                    }
                    if (filters?.maxFee) {
                        query = query.lte('consultation_fee', filters.maxFee);
                    }
                    if (filters?.search) {
                        query = query.or(`display_name.ilike.%${filters.search}%,specialization.ilike.%${filters.search}%`);
                    }

                    const { data, error } = await query.order('created_at', { ascending: false });

                    if (error) {
                        if (isNetworkError(error)) {
                            logger.warn(`[Doctor Cache] Network error fetching doctors, retrying...`, error.message);
                            throw error;
                        }
                        logger.error(`[Doctor Cache] Error fetching doctors:`, error);
                        return [];
                    }

                    return (data as DoctorProfile[]) || [];
                }, { retries: 2, delay: 1000, shouldRetry: isNetworkError });
            },
            { ttl: CacheTTL.DOCTOR_LIST } // 5 minutes
        );

        return doctors;
    } catch (error) {
        logger.error('[Doctor Cache] Failed to get doctor list:', error);
        return [];
    }
}

/**
 * Invalidate all doctor list caches
 * Call this when a doctor profile is updated or new doctor is added
 */
export async function invalidateDoctorListCache(): Promise<void> {
    // Note: In production, you'd want to track all cache keys and delete them
    // For now, we'll delete the common ones
    await deleteCache(CacheKeys.doctorList());
}

/**
 * Get cached doctor profile by ID
 * Uses the user profile cache under the hood
 * 
 * @param doctorId - Doctor user ID
 * @returns Doctor profile or null
 */
export async function getCachedDoctorProfile(doctorId: string): Promise<DoctorProfile | null> {
    const cacheKey = CacheKeys.doctorProfile(doctorId);

    const profile = await getCacheOrSet<DoctorProfile | null>(
        cacheKey,
        async () => {
            return await withRetry(async () => {
                const supabase = await createClient();
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', doctorId)
                    .eq('role', 'doctor')
                    .single();

                if (error) {
                    if (isNetworkError(error)) {
                        console.warn(`[Doctor Cache] Network error fetching doctor ${doctorId}, retrying...`, error.message);
                        throw error;
                    }
                    console.error(`[Doctor Cache] Error fetching doctor:`, error);
                    return null;
                }

                return data as DoctorProfile;
            }, { retries: 2, delay: 1000, shouldRetry: isNetworkError });
        },
        { ttl: CacheTTL.USER_PROFILE } // 1 hour
    );

    return profile;
}

/**
 * Invalidate doctor profile cache
 * Call this when doctor updates their profile
 * 
 * @param doctorId - Doctor user ID
 */
export async function invalidateDoctorProfileCache(doctorId: string): Promise<void> {
    await deleteCache(CacheKeys.doctorProfile(doctorId));
    // Also invalidate doctor lists since they might include this doctor
    await invalidateDoctorListCache();
}
