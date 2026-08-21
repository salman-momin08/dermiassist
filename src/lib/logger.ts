/**
 * @fileOverview Structured logger for DermiAssist-AI.
 *
 * - Production:  emits newline-delimited JSON (NDJSON) compatible with
 *                Datadog, Grafana Loki, Vercel log drains, etc.
 * - Development: emits human-readable prefixed lines for easy reading.
 *
 * Usage:
 *   logger.info('cache.hit', { key: 'user:123:profile', ttl: 3600 });
 *   logger.error('ai.flow.failed', { flow: 'finalEvaluation', userId });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const configuredLevel = (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info';
const isProduction = process.env.NODE_ENV === 'production';

function emit(level: LogLevel, event: string, data?: unknown): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[configuredLevel]) return;

    const payload = typeof data === 'object' && data !== null ? data : { detail: data };

    if (isProduction) {
        // NDJSON — one log entry per line; pipe-friendly for log aggregators
        const entry = JSON.stringify({
            level,
            event,
            ts: new Date().toISOString(),
            ...payload,
        });
        console[level](entry);
    } else {
        // Human-readable format for local development
        const prefix = `[${level.toUpperCase().padEnd(5)}] ${event}`;
        if (data !== undefined) {
            console[level](prefix, payload);
        } else {
            console[level](prefix);
        }
    }
}

export const logger = {
    debug: (event: string, data?: unknown) => emit('debug', event, data),
    info:  (event: string, data?: unknown) => emit('info',  event, data),
    warn:  (event: string, data?: unknown) => emit('warn',  event, data),
    error: (event: string, data?: unknown) => emit('error', event, data),
} as const;
