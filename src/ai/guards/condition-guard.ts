/**
 * @fileOverview AI Output Guard — Condition Name Validation & Sanitization.
 *
 * Problem:
 *   AI models can hallucinate or be prompt-injected into returning malicious
 *   strings. The `conditionName` from Gemini flows is stored directly in the
 *   database and rendered in the UI — both XSS attack surfaces.
 *
 * Solution:
 *   - Strip any HTML / script injection before use or storage
 *   - Enforce a maximum length
 *   - Optionally log unexpected condition names for model quality monitoring
 */

import { logger } from '@/lib/logger';

/**
 * Curated list of recognizable dermatological condition names.
 * This is used for LOGGING / MONITORING only — not as a hard block,
 * since AI models may legitimately identify rare or niche conditions.
 *
 * To hard-block unknown conditions, change `warnOnly` to false in
 * `validateConditionName`.
 */
const KNOWN_CONDITIONS = new Set([
    // Common inflammatory conditions
    'Acne Vulgaris',
    'Acne',
    'Eczema',
    'Atopic Dermatitis',
    'Psoriasis',
    'Rosacea',
    'Seborrheic Dermatitis',
    'Contact Dermatitis',
    'Perioral Dermatitis',

    // Fungal / Parasitic
    'Ringworm',
    'Tinea Corporis',
    'Tinea Pedis',
    'Tinea Versicolor',
    'Scabies',

    // Bacterial
    'Impetigo',
    'Cellulitis',
    'Folliculitis',

    // Viral
    'Warts',
    'Molluscum Contagiosum',
    'Herpes Zoster',
    'Chickenpox',

    // Pigmentation / Structural
    'Melasma',
    'Vitiligo',
    'Age Spots',
    'Hyperpigmentation',
    'Keratosis Pilaris',

    // Growths / Lesions
    'Melanoma',
    'Basal Cell Carcinoma',
    'Squamous Cell Carcinoma',
    'Seborrheic Keratosis',
    'Dermatofibroma',
    'Lipoma',
    'Cyst',
    'Milia',
    'Cherry Angioma',
    'Spider Angioma',
    'Keloid',

    // Hair / Nail
    'Alopecia Areata',
    'Onychomycosis',

    // Other common
    'Urticaria',
    'Hives',
    'Sunburn',
    'Dry Skin',
    'Xerosis',
]);

/**
 * Sanitize a condition name returned by the AI model.
 *
 * - Strips HTML tags and dangerous characters (XSS prevention)
 * - Enforces maximum length
 * - Normalizes whitespace
 *
 * @param rawName - Raw condition name from AI output
 * @returns Sanitized condition name safe for storage and display
 * @throws Error if the sanitized result is empty
 */
export function sanitizeConditionName(rawName: string): string {
    if (typeof rawName !== 'string') {
        throw new Error('Condition name must be a string');
    }

    const sanitized = rawName
        .replace(/<[^>]*>/g, '')          // Strip HTML tags
        .replace(/[<>"'`]/g, '')           // Strip remaining dangerous chars
        .replace(/javascript:/gi, '')      // Strip JS protocol
        .replace(/\s+/g, ' ')             // Normalize whitespace
        .trim()
        .slice(0, 120);                   // Enforce max length

    if (!sanitized) {
        throw new Error('AI returned an empty or unparseable condition name');
    }

    return sanitized;
}

/**
 * Validate and sanitize a condition name, with optional logging for
 * unknown conditions to support model quality monitoring.
 *
 * @param rawName      - Raw condition name from AI output
 * @param flowName     - Name of the flow that produced this output (for logging)
 * @param warnOnly     - If true (default), unknown conditions are logged but not
 *                       rejected. Set to false to hard-reject unknown conditions.
 */
export function validateConditionName(
    rawName: string,
    flowName = 'unknown',
    warnOnly = true
): string {
    const sanitized = sanitizeConditionName(rawName);

    // Check if the condition is in our known list (case-insensitive)
    const isKnown = [...KNOWN_CONDITIONS].some(
        known => known.toLowerCase() === sanitized.toLowerCase()
    );

    if (!isKnown) {
        logger.warn('ai.condition.unknown', {
            flow: flowName,
            condition: sanitized,
            knownCount: KNOWN_CONDITIONS.size,
        });

        if (!warnOnly) {
            throw new Error(
                `AI returned an unrecognized condition name: "${sanitized}". ` +
                `Contact support if this is a valid medical condition.`
            );
        }
    }

    return sanitized;
}
