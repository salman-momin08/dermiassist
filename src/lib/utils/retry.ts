/**
 * Retry utility for handling transient errors
 */

interface RetryOptions {
    retries?: number;
    delay?: number;
    backoffFactor?: number;
    shouldRetry?: (error: any) => boolean;
}

/**
 * Retry a promise-returning function with exponential backoff
 * 
 * @param fn - Async function to retry
 * @param options - Retry configuration
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        retries = 3,
        delay = 1000,
        backoffFactor = 2,
        shouldRetry = () => true
    } = options;

    try {
        return await fn();
    } catch (error) {
        if (retries <= 0 || !shouldRetry(error)) {
            throw error;
        }

        // Wait for delay
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry with decremented count and increased delay
        return withRetry(fn, {
            retries: retries - 1,
            delay: delay * backoffFactor,
            backoffFactor,
            shouldRetry
        });
    }
}

/**
 * Check if an error is a network/connection error that should be retried
 */
export function isNetworkError(error: any): boolean {
    if (!error) return false;

    const message = error.message || error.details || '';
    const code = error.code || '';

    return (
        message.includes('fetch failed') ||
        message.includes('SocketError') ||
        message.includes('other side closed') ||
        message.includes('ECONNRESET') ||
        message.includes('ETIMEDOUT') ||
        code === 'UND_ERR_SOCKET' ||
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT'
    );
}
