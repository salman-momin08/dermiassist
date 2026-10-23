import crypto from 'crypto';

/**
 * AI Analysis Cache Utilities
 * 
 * Functions for caching AI analysis results to reduce Gemini API costs
 * and improve response times for duplicate analyses.
 */

/**
 * Generate a hash from an image data URI
 * This creates a unique identifier for each image
 * 
 * @param dataUri - Image data URI (data:image/jpeg;base64,...)
 * @returns SHA-256 hash of the image data
 */
export function hashImageDataUri(dataUri: string): string {
    // Extract just the base64 data (remove the data:image/...;base64, prefix)
    const base64Data = dataUri.split(',')[1] || dataUri;

    // Create SHA-256 hash
    const hash = crypto
        .createHash('sha256')
        .update(base64Data)
        .digest('hex');

    return hash;
}

/**
 * Generate a cache key for disease name detection
 * @param imageHash - Hash of the image
 */
export function getDetectDiseaseNameCacheKey(imageHash: string): string {
    return `ai:detect-disease:${imageHash}`;
}

/**
 * Generate a cache key for final evaluation
 * Includes image hash and a hash of the user answers for uniqueness
 * 
 * @param imageHash - Hash of the image
 * @param userAnswers - User's proforma answers
 */
export function getFinalEvaluationCacheKey(
    imageHash: string,
    userAnswers: string,
    initialCondition: string
): string {
    // Hash the user answers to create a unique key
    const answersHash = crypto
        .createHash('sha256')
        .update(JSON.stringify([initialCondition, userAnswers]))
        .digest('hex')
        .substring(0, 16); // Use first 16 chars for brevity

    return `ai:final-eval:v2:${imageHash}:${answersHash}`;
}

export function getProformaQuestionCacheKey(conditionName: string, conversationHistory: string): string {
    const contextHash = crypto
        .createHash('sha256')
        .update(JSON.stringify([conditionName.trim().replace(/\s+/g, ' ').toLowerCase(), conversationHistory]))
        .digest('hex');

    return `ai:proforma-question:v1:${contextHash}`;
}

export function getQuestionSuggestionsCacheKey(
    question: string,
    conditionName = '',
    conversationHistory = ''
): string {
    const contextHash = crypto
        .createHash('sha256')
        .update(JSON.stringify([conditionName.trim().replace(/\s+/g, ' ').toLowerCase(), question, conversationHistory]))
        .digest('hex');

    return `ai:question-suggestions:v1:${contextHash}`;
}

/**
 * Truncate image data URI for logging (to avoid huge console logs)
 * @param dataUri - Full data URI
 * @param maxLength - Maximum length to show
 */
export function truncateDataUri(dataUri: string, maxLength: number = 50): string {
    if (dataUri.length <= maxLength) return dataUri;
    return `${dataUri.substring(0, maxLength)}... (${dataUri.length} chars total)`;
}
