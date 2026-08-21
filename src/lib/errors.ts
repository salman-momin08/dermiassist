/**
 * @fileOverview Typed custom error classes for DermiAssist-AI.
 *
 * Using named error classes instead of raw `Error` objects gives us:
 *  - Type-safe `instanceof` checks in catch blocks
 *  - Structured context attached to every error
 *  - Consistent serialization for logging and API responses
 */

// ─────────────────────────────────────────────────────────────
// Base error
// ─────────────────────────────────────────────────────────────

export class AppError extends Error {
    /** HTTP-equivalent status code for API responses */
    public readonly statusCode: number;
    /** Structured context for logging */
    public readonly context: Record<string, unknown>;
    /** Machine-readable error code */
    public readonly code: string;

    constructor(
        message: string,
        options: {
            statusCode?: number;
            code?: string;
            context?: Record<string, unknown>;
            cause?: unknown;
        } = {}
    ) {
        super(message, { cause: options.cause });
        this.name = this.constructor.name;
        this.statusCode = options.statusCode ?? 500;
        this.code = options.code ?? 'INTERNAL_ERROR';
        this.context = options.context ?? {};

        // Maintains proper prototype chain in transpiled environments
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

// ─────────────────────────────────────────────────────────────
// AI / LLM Errors
// ─────────────────────────────────────────────────────────────

/**
 * Thrown when an AI model returns a null / empty output.
 * This usually indicates a safety filter block or API error.
 */
export class AIOutputError extends AppError {
    constructor(
        message: string,
        context: { flow: string; [key: string]: unknown } = { flow: 'unknown' }
    ) {
        super(message, {
            statusCode: 502,
            code: 'AI_OUTPUT_NULL',
            context,
        });
    }
}

/**
 * Thrown when the AI model returns output that fails schema validation
 * or contains unexpected / potentially unsafe content.
 */
export class AIValidationError extends AppError {
    constructor(
        message: string,
        context: { flow: string; field?: string; [key: string]: unknown } = { flow: 'unknown' }
    ) {
        super(message, {
            statusCode: 422,
            code: 'AI_VALIDATION_FAILED',
            context,
        });
    }
}

/**
 * Thrown when an AI flow is invoked but the upstream API is unavailable
 * (e.g., Gemini returns a 5xx or network timeout).
 */
export class AIServiceUnavailableError extends AppError {
    constructor(
        message: string,
        context: { flow: string; [key: string]: unknown } = { flow: 'unknown' }
    ) {
        super(message, {
            statusCode: 503,
            code: 'AI_SERVICE_UNAVAILABLE',
            context,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// Rate Limiting
// ─────────────────────────────────────────────────────────────

export class RateLimitError extends AppError {
    public readonly retryAfter: number;

    constructor(
        message: string,
        context: { endpoint: string; identifier: string; retryAfter?: number; [key: string]: unknown }
    ) {
        super(message, {
            statusCode: 429,
            code: 'RATE_LIMIT_EXCEEDED',
            context,
        });
        this.retryAfter = context.retryAfter ?? 60;
    }
}

// ─────────────────────────────────────────────────────────────
// Auth / Authorization
// ─────────────────────────────────────────────────────────────

export class AuthenticationError extends AppError {
    constructor(message = 'Authentication required', context?: Record<string, unknown>) {
        super(message, { statusCode: 401, code: 'UNAUTHENTICATED', context });
    }
}

export class AuthorizationError extends AppError {
    constructor(message = 'You do not have permission to perform this action', context?: Record<string, unknown>) {
        super(message, { statusCode: 403, code: 'UNAUTHORIZED', context });
    }
}

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

export class ValidationError extends AppError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, { statusCode: 400, code: 'VALIDATION_ERROR', context });
    }
}

// ─────────────────────────────────────────────────────────────
// File / Upload
// ─────────────────────────────────────────────────────────────

export class FileUploadError extends AppError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, { statusCode: 400, code: 'FILE_UPLOAD_ERROR', context });
    }
}

// ─────────────────────────────────────────────────────────────
// Not Found
// ─────────────────────────────────────────────────────────────

export class NotFoundError extends AppError {
    constructor(resource: string, id?: string) {
        super(`${resource}${id ? ` '${id}'` : ''} not found`, {
            statusCode: 404,
            code: 'NOT_FOUND',
            context: { resource, id },
        });
    }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Serialize an error to a plain object safe for API responses.
 * In production, context is omitted to avoid leaking internals.
 */
export function serializeError(
    error: unknown,
    isDevelopment = process.env.NODE_ENV === 'development'
): { error: string; code: string; context?: Record<string, unknown> } {
    if (error instanceof AppError) {
        return {
            error: error.message,
            code: error.code,
            ...(isDevelopment ? { context: error.context } : {}),
        };
    }

    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return {
        error: isDevelopment ? message : 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
    };
}
