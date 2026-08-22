/**
 * @fileOverview Input Guardrail Module.
 * Sanitizes user prompt inputs against prompt injection attacks, jailbreak attempts,
 * and masks sensitive PII (Personally Identifiable Information).
 */

import { logger } from '@/lib/logger';

export interface GuardrailInputResult {
    safe: boolean;
    sanitizedPrompt: string;
    flaggedReasons: string[];
    piiDetected: boolean;
}

const PROMPT_INJECTION_PATTERNS = [
    /ignore (all )?previous instructions/i,
    /system prompt override/i,
    /you are now a/i,
    /dan mode/i,
    /bypass safety/i,
    /reveal confidential/i,
    /act as an unrestricted/i,
    /pretend you are not an AI/i,
];

const PII_REGEX_PATTERNS = {
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    phone: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    creditCard: /\b(?:\d[ -]*?){13,16}\b/g,
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
};

/**
 * Validate and sanitize user input before passing to LLM workflows.
 */
export function validateAndSanitizeInput(rawPrompt: string): GuardrailInputResult {
    const flaggedReasons: string[] = [];
    let sanitized = rawPrompt;
    let piiDetected = false;

    // 1. Check for prompt injection / jailbreak patterns
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
        if (pattern.test(rawPrompt)) {
            flaggedReasons.push(`Suspected prompt injection or policy bypass attempt: "${pattern.source}"`);
        }
    }

    // 2. Detect & Mask PII
    if (PII_REGEX_PATTERNS.ssn.test(sanitized)) {
        sanitized = sanitized.replace(PII_REGEX_PATTERNS.ssn, '[REDACTED SSN]');
        piiDetected = true;
    }

    if (PII_REGEX_PATTERNS.creditCard.test(sanitized)) {
        sanitized = sanitized.replace(PII_REGEX_PATTERNS.creditCard, '[REDACTED CARD]');
        piiDetected = true;
    }

    if (flaggedReasons.length > 0) {
        logger.warn('ai.guardrail.input.flagged', {
            reasons: flaggedReasons,
            originalLength: rawPrompt.length,
        });
    }

    return {
        safe: flaggedReasons.length === 0,
        sanitizedPrompt: sanitized,
        flaggedReasons,
        piiDetected,
    };
}
