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
        // Never fabricate a pseudo-vector: a mock embedding would silently corrupt
        // similarity search and semantic caching for medical content. Fail loudly.
        logger.error('gemini.embedding.missing_key', { message: 'GEMINI_API_KEY / GOOGLE_GENAI_API_KEY is not set.' });
        throw new Error('Embedding generation failed: no Gemini API key configured.');
    }

    // 2. Try Gemini Embedding API (use fastest model first)
    const modelsToTry = ['text-embedding-004', 'embedding-001'];

    for (const modelName of modelsToTry) {
        try {
            // Key goes in a header, not the URL query string — a `?key=...` query
            // param can end up in logs, error messages, or network traces.
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
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

    // All embedding models failed. Do NOT return a deterministic pseudo-vector — a fake
    // embedding would silently produce meaningless similarity scores and cache hits for
    // medical queries. Propagate the failure so callers can degrade honestly.
    logger.error('gemini.embedding.failed', { message: 'All Gemini embedding models failed to return a vector.' });
    throw new Error('Embedding generation failed: no embedding model returned a valid vector.');
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
