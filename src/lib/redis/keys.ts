/**
 * Cache key generators for DermiAssist Redis cache
 * 
 * Centralized key generation ensures consistency and makes it easier
 * to manage cache invalidation patterns.
 */

export const CacheKeys = {
    // User-related keys
    userProfile: (userId: string) => `user:${userId}:profile`,
    userSession: (userId: string) => `user:${userId}:session`,
    userPreferences: (userId: string) => `user:${userId}:preferences`,

    // AI Analysis keys
    analysis: (imageHash: string) => `analysis:${imageHash}`,
    analysisExplanation: (analysisId: string, language: string) =>
        `analysis:${analysisId}:explanation:${language}`,

    // Doctor-related keys
    doctorProfile: (doctorId: string) => `doctor:${doctorId}:profile`,
    doctorList: (filters?: string) => filters ? `doctors:list:${filters}` : 'doctors:list:all',

    // Appointment keys
    appointment: (appointmentId: string) => `appointment:${appointmentId}`,
    userAppointments: (userId: string) => `user:${userId}:appointments`,
    doctorAppointments: (doctorId: string) => `doctor:${doctorId}:appointments`,

    // Rate limiting keys
    rateLimit: (endpoint: string, userId: string) => `ratelimit:${endpoint}:${userId}`,

    // Admin keys
    adminStats: () => 'admin:stats',
    adminRequests: (status?: string) => status ? `admin:requests:${status}` : 'admin:requests:all',

    // Chat keys
    chatChannel: (channelId: string) => `chat:${channelId}`,

    // Notification queue
    notificationQueue: () => 'queue:notifications',
} as const;

/**
 * Cache TTL (Time To Live) values in seconds
 */
export const CacheTTL = {
    // Short-lived cache (1-5 minutes)
    VERY_SHORT: 60,           // 1 minute
    SHORT: 300,               // 5 minutes

    // Medium-lived cache (15 minutes - 1 hour)
    MEDIUM: 900,              // 15 minutes
    HOUR: 3600,               // 1 hour

    // Long-lived cache (1 day - 1 week)
    DAY: 86400,               // 24 hours
    WEEK: 604800,             // 7 days
    MONTH: 2592000,           // 30 days

    // Specific use cases
    USER_PROFILE: 3600,       // 1 hour
    DOCTOR_LIST: 300,         // 5 minutes
    AI_ANALYSIS: 2592000,     // 30 days
    SESSION: 86400,           // 24 hours
    RATE_LIMIT_WINDOW: 60,    // 1 minute
} as const;

/**
 * Generate a cache key pattern for bulk operations
 * @param pattern - Pattern with wildcards (e.g., "user:*:profile")
 */
export function getCachePattern(pattern: string): string {
    return pattern;
}
