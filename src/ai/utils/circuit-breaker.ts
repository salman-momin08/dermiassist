/**
 * @fileOverview Circuit Breaker Resilience Pattern for External AI APIs (Gemini).
 * Mirrors `ai_service/utils/circuit_breaker.py`: CLOSED -> OPEN -> HALF_OPEN.
 * Prevents cascade failures/timeouts from hammering a rate-limited or
 * regionally-down Gemini endpoint by short-circuiting calls once a failure
 * threshold is crossed, then probing again after a cooldown window.
 */

import { logger } from '@/lib/logger';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerStatus {
    name: string;
    state: CircuitBreakerState;
    failureCount: number;
    failureThreshold: number;
    resetTimeoutMs: number;
}

export class CircuitBreaker {
    private readonly name: string;
    private readonly failureThreshold: number;
    private readonly resetTimeoutMs: number;

    private state: CircuitBreakerState = 'CLOSED';
    private failureCount = 0;
    private lastFailureTime = 0;

    constructor(name: string, failureThreshold = 3, resetTimeoutMs = 30_000) {
        this.name = name;
        this.failureThreshold = failureThreshold;
        this.resetTimeoutMs = resetTimeoutMs;
    }

    /**
     * Check whether a call is currently permitted. When OPEN, allows exactly
     * one probe call through as HALF_OPEN once the reset timeout has elapsed.
     */
    canExecute(): boolean {
        if (this.state === 'HALF_OPEN') return false;
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
                this.state = 'HALF_OPEN';
                return true;
            }
            return false;
        }
        return true;
    }

    /** Record a successful call: closes the breaker and resets the failure count. */
    recordSuccess(): void {
        if (this.state === 'HALF_OPEN') {
            logger.info('ai.circuit_breaker.closed', { name: this.name });
        }
        this.state = 'CLOSED';
        this.failureCount = 0;
    }

    /** Record a failed call: trips the breaker OPEN once the threshold is crossed. */
    recordFailure(): void {
        this.failureCount += 1;
        this.lastFailureTime = Date.now();
        if (this.failureCount >= this.failureThreshold) {
            if (this.state !== 'OPEN') {
                logger.warn('ai.circuit_breaker.opened', {
                    name: this.name,
                    failureCount: this.failureCount,
                });
            }
            this.state = 'OPEN';
        }
    }

    getStatus(): CircuitBreakerStatus {
        return {
            name: this.name,
            state: this.state,
            failureCount: this.failureCount,
            failureThreshold: this.failureThreshold,
            resetTimeoutMs: this.resetTimeoutMs,
        };
    }
}

/** Shared breaker instance for all Gemini/Genkit model calls in the TS pipeline. */
export const geminiCircuitBreaker = new CircuitBreaker('Gemini-API', 3, 30_000);
