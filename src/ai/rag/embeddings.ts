/**
 * @fileOverview Embedding generator and text chunking utilities for RAG.
 * Includes an in-memory LRU cache to eliminate redundant Gemini API calls.
 */

import { logger } from '@/lib/logger';

export interface SemanticChunk {
    title: string;
    conditionCategory: string;
    content: string;
    source: string;
    icdCode?: string;
    metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Embedding LRU Cache — eliminates ~750ms of redundant API calls
// ─────────────────────────────────────────────────────────────
const EMBEDDING_CACHE_MAX = 200;
const embeddingCache = new Map<string, number[]>();

function normalizeForCache(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function evictOldestIfNeeded(): void {
    if (embeddingCache.size >= EMBEDDING_CACHE_MAX) {
        const oldest = embeddingCache.keys().next().value;
        if (oldest) embeddingCache.delete(oldest);
    }
}

/**
 * Generate 768-dimensional vector embedding for text using Google Gemini Embedding API.
 * Results are LRU-cached in memory to avoid redundant network calls.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    // 1. Check LRU cache first (0ms vs 200-400ms API call)
    const cacheKey = normalizeForCache(text);
    const cached = embeddingCache.get(cacheKey);
    if (cached) {
        // Move to end for LRU ordering (delete + re-insert)
        embeddingCache.delete(cacheKey);
        embeddingCache.set(cacheKey, cached);
        return cached;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
        logger.warn('gemini.embedding.missing_key', { message: 'GEMINI_API_KEY is not set. Using pseudo-vector fallback.' });
        const mock = generateMockEmbedding(text);
        evictOldestIfNeeded();
        embeddingCache.set(cacheKey, mock);
        return mock;
    }

    // 2. Try Gemini Embedding API (use fastest model first)
    const modelsToTry = ['text-embedding-004', 'embedding-001'];

    for (const modelName of modelsToTry) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: {
                            parts: [{ text }],
                        },
                    }),
                }
            );

            if (!response.ok) {
                continue;
            }

            const data = await response.json();
            const values = data.embedding?.values as number[] | undefined;

            if (values && Array.isArray(values) && values.length > 0) {
                let finalVector: number[];
                // Ensure vector length is padded or normalized to 768 dimensions
                if (values.length === 768) {
                    finalVector = values;
                } else if (values.length < 768) {
                    finalVector = [...values, ...new Array(768 - values.length).fill(0)];
                } else {
                    finalVector = values.slice(0, 768);
                }

                // 3. Store in LRU cache
                evictOldestIfNeeded();
                embeddingCache.set(cacheKey, finalVector);
                return finalVector;
            }
        } catch {
            // Try next model
        }
    }

    logger.warn('gemini.embedding.fallback', { message: 'Using deterministic pseudo-embedding fallback.' });
    const fallback = generateMockEmbedding(text);
    evictOldestIfNeeded();
    embeddingCache.set(cacheKey, fallback);
    return fallback;
}

/**
 * Deterministic fallback embedding generator for testing without API keys.
 */
function generateMockEmbedding(text: string): number[] {
    const vector = new Array(768).fill(0);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0;
    }
    for (let i = 0; i < 768; i++) {
        vector[i] = Math.sin(hash + i) * 0.5;
    }
    return vector;
}

/**
 * Chunk a long medical document into overlapping semantic passages.
 */
export function chunkMedicalText(
    text: string,
    maxChunkLength = 500,
    overlap = 50
): string[] {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
        if ((currentChunk + ' ' + sentence).length > maxChunkLength && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            const words = currentChunk.split(' ');
            currentChunk = words.slice(Math.max(0, words.length - overlap)).join(' ') + ' ' + sentence;
        } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
        }
    }

    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}
