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
 * Fetch and cache the full unfiltered list of doctor profiles under a single
 * stable cache key, regardless of which filters the caller wants applied.
 *
 * This intentionally does NOT key the cache by filter combination: Upstash
 * doesn't support pattern/SCAN deletes (see deleteCachePattern in cache.ts),
 * so a per-filter cache key can never be reliably invalidated when a doctor's
 * `verified` status or profile changes — it would just sit stale until its
 * TTL expired. Caching one base list and filtering in memory means a single
 * invalidateDoctorListCache() call actually busts everything callers see.
 */
async function getCachedAllDoctors(): Promise<DoctorProfile[]> {
    try {
        return await getCacheOrSet<DoctorProfile[]>(
            CacheKeys.doctorList(),
            async () => {
                return await withRetry(async () => {
                    const supabase = await createClient();
                    // Explicit column list — never '*' here: this table also carries
                    // leftover patient-only PII (dob, gender, blood_group, city, state,
                    // address) on rows that changed role from patient to doctor, and
                    // this result set is served to the public doctor listing.
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('id, email, display_name, photo_url, verified, specialization, location, bio, phone, signature_url, education, certificates, years_of_experience, languages, consultation_fee, role, created_at, updated_at')
                        .eq('role', 'doctor')
                        .order('created_at', { ascending: false });

                    if (error) {
                        if (isNetworkError(error)) {
                            logger.warn(`[Doctor Cache] Network error fetching doctors, retrying...`, error.message);
                            throw error;
                        }
                        // Throw so a query failure is NOT cached (would otherwise persist
                        // a transient outage as "no doctors available" for the TTL).
                        logger.error(`[Doctor Cache] Error fetching doctors:`, error);
                        throw new Error(`Failed to fetch doctor list: ${error.message}`);
                    }

                    return (data as DoctorProfile[]) || [];
                }, { retries: 2, delay: 1000, shouldRetry: isNetworkError });
            },
            { ttl: CacheTTL.DOCTOR_LIST } // 5 minutes
        );
    } catch (error) {
        logger.error('[Doctor Cache] Failed to get doctor list:', error);
        return [];
    }
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
    const all = await getCachedAllDoctors();

    if (!filters) return all;

    return all.filter((doctor) => {
        if (filters.specialization && doctor.specialization !== filters.specialization) return false;
        if (filters.verified !== undefined && !!doctor.verified !== filters.verified) return false;
        const fee = doctor.consultation_fee !== undefined ? Number(doctor.consultation_fee) : undefined;
        if (filters.minFee !== undefined && !(fee !== undefined && fee >= filters.minFee)) return false;
        if (filters.maxFee !== undefined && !(fee !== undefined && fee <= filters.maxFee)) return false;
        if (filters.search) {
            const needle = filters.search.toLowerCase();
            const haystack = `${doctor.display_name ?? ''} ${doctor.specialization ?? ''}`.toLowerCase();
            if (!haystack.includes(needle)) return false;
        }
        return true;
    });
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
                    // PGRST116 = no rows: a legitimate "not found" that is safe to cache as null.
                    if (error.code === 'PGRST116') {
                        return null;
                    }
                    // Any other query failure must NOT be cached — throw so it is not persisted.
                    console.error(`[Doctor Cache] Error fetching doctor:`, error);
                    throw new Error(`Failed to fetch doctor profile: ${error.message}`);
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
