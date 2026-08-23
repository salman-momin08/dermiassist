/**
 * @fileOverview Observability hooks for DermiAssist-AI.
 *
 * This module provides a lightweight telemetry facade that:
 *  - Emits structured log events for key platform actions
 *  - Can be wired to any external observability backend
 *    (Datadog, OpenTelemetry, Grafana, etc.) by replacing the
 *    `emit` call below — no callsites need to change.
 *
 * Current backend: structured logger (stdout/Vercel log drain).
 * Future: plug in @opentelemetry/sdk-node or dd-trace here.
 */

import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface BaseEvent {
    userId?: string;
    sessionId?: string;
    [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────
// AI Flow Events
// ─────────────────────────────────────────────────────────────

export const telemetry = {
    /**
     * Track an AI flow invocation.
     * Called by cached wrappers to record whether the result
     * came from cache or from a live Gemini API call.
     */
    aiFlowInvoked(event: BaseEvent & {
        flow: string;
        cached: boolean;
        durationMs?: number;
        conditionName?: string;
    }): void {
        logger.info('telemetry.ai_flow.invoked', event);
    },

    recordAiTelemetry(event: {
        flowName: string;
        executionTimeMs: number;
        success: boolean;
        // Real token usage reported by the model, when available. Omitted/null when
        // the underlying flow does not surface usage — never a fabricated estimate.
        tokensUsed?: number | null;
        metadata?: Record<string, unknown>;
    }): void {
        logger.info('telemetry.ai.execution', event);
    },

    /**
     * Track an AI flow failure for alerting and error budgets.
     */
    aiFlowFailed(event: BaseEvent & {
        flow: string;
        errorCode: string;
        errorMessage: string;
    }): void {
        logger.error('telemetry.ai_flow.failed', event);
    },

    // ─────────────────────────────────────────────────────────
    // Rate Limiting Events
    // ─────────────────────────────────────────────────────────

    /**
     * Track when a rate limit is hit.
     * Useful for alerting on abuse patterns.
     */
    rateLimitHit(event: BaseEvent & {
        endpoint: string;
        identifier: string;
        limit: number;
    }): void {
        logger.warn('telemetry.rate_limit.hit', event);
    },

    // ─────────────────────────────────────────────────────────
    // Cache Events
    // ─────────────────────────────────────────────────────────

    cacheHit(event: BaseEvent & { cacheKey: string; flow?: string }): void {
        logger.debug('telemetry.cache.hit', event);
    },

    cacheMiss(event: BaseEvent & { cacheKey: string; flow?: string }): void {
        logger.debug('telemetry.cache.miss', event);
    },

    // ─────────────────────────────────────────────────────────
    // Auth Events
    // ─────────────────────────────────────────────────────────

    authEvent(event: BaseEvent & {
        action: 'login' | 'logout' | 'signup' | 'unauthorized_access';
        role?: string;
        path?: string;
    }): void {
        logger.info('telemetry.auth.event', event);
    },

    // ─────────────────────────────────────────────────────────
    // Analysis Lifecycle Events
    // ─────────────────────────────────────────────────────────

    /**
     * Track when a user completes a full analysis (upload → proforma → report).
     * Critical business metric.
     */
    analysisCompleted(event: BaseEvent & {
        conditionName: string;
        proformaQuestionsAnswered: number;
        cachedResult: boolean;
    }): void {
        logger.info('telemetry.analysis.completed', event);
    },

    analysisAbandoned(event: BaseEvent & {
        step: string;
        reason?: string;
    }): void {
        logger.info('telemetry.analysis.abandoned', event);
    },

    // ─────────────────────────────────────────────────────────
    // File Upload Events
    // ─────────────────────────────────────────────────────────

    fileUploaded(event: BaseEvent & {
        folder: string;
        fileSizeBytes?: number;
        durationMs?: number;
    }): void {
        logger.info('telemetry.file.uploaded', event);
    },

    fileUploadFailed(event: BaseEvent & {
        folder: string;
        errorMessage: string;
    }): void {
        logger.error('telemetry.file.upload_failed', event);
    },
} as const;

export function recordAiTelemetry(event: {
    flowName: string;
    executionTimeMs: number;
    success: boolean;
    tokensUsed?: number | null;
    metadata?: Record<string, unknown>;
}): void {
    telemetry.recordAiTelemetry(event);
}
