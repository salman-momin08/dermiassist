/**
 * @fileOverview Semantic Cache Layer.
 * Provides vector-similarity & normalized hash caching using In-Memory store
 * to return sub-50ms cached AI responses for recurring diagnostic queries.
 *
 * Optimizations:
 *  - Exact match returns instantly without generating an embedding vector
 *  - TTL-based expiry (30 min) prevents stale results
 *  - LRU eviction when cache exceeds max entries
 */

import { generateEmbedding } from '@/ai/rag/embeddings';
import { logger } from '@/lib/logger';

interface CacheEntry<T> {
    embedding: number[];
    data: T;
    createdAt: number;
}

const IN_MEMORY_CACHE = new Map<string, CacheEntry<unknown>>();
const SIMILARITY_THRESHOLD = 0.92;
const CACHE_MAX_ENTRIES = 100;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Compute cosine similarity between two vector arrays.
 */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Evict expired entries from the cache.
 */
function evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of IN_MEMORY_CACHE.entries()) {
        if (now - entry.createdAt > CACHE_TTL_MS) {
            IN_MEMORY_CACHE.delete(key);
        }
    }
}

/**
 * Retrieve cached output if a semantically similar query exists.
 * Fast path: exact normalized string match returns instantly without embedding generation.
 */
export async function getSemanticCache<T>(query: string): Promise<T | null> {
    const normalizedQuery = query.trim().toLowerCase();

    // Fast path: exact string match — NO embedding API call needed (0ms)
    const exactEntry = IN_MEMORY_CACHE.get(normalizedQuery);
    if (exactEntry) {
        // Check TTL
        if (Date.now() - exactEntry.createdAt > CACHE_TTL_MS) {
            IN_MEMORY_CACHE.delete(normalizedQuery);
        } else {
            logger.info('ai.cache.hit.exact', { queryLength: query.length });
            return exactEntry.data as T;
        }
    }

    // Slow path: Semantic Vector Similarity Match (requires embedding)
    // Only run if cache has entries to compare against
    if (IN_MEMORY_CACHE.size === 0) {
        logger.info('ai.cache.miss');
        return null;
    }

    evictExpired();

    // Embedding generation can now fail (e.g. missing API key). If it does, treat the
    // semantic path as a MISS rather than matching a medical report over a fabricated
    // vector. The exact-match fast path above is unaffected.
    let queryEmbedding: number[];
    try {
        queryEmbedding = await generateEmbedding(query);
    } catch (err) {
        logger.warn('ai.cache.embedding_unavailable', { error: String(err) });
        logger.info('ai.cache.miss');
        return null;
    }

    try {
        for (const [cachedKey, entry] of IN_MEMORY_CACHE.entries()) {
            // Skip entries stored without a usable vector — never match over an empty
            // or mismatched embedding.
            if (!entry.embedding || entry.embedding.length !== queryEmbedding.length) continue;
            const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
            if (similarity >= SIMILARITY_THRESHOLD) {
                logger.info('ai.cache.hit.semantic', {
                    similarity: similarity.toFixed(3),
                    cachedKey,
                });
                return entry.data as T;
            }
        }
    } catch (err) {
        logger.warn('ai.cache.similarity_error', { error: String(err) });
    }

    logger.info('ai.cache.miss');
    return null;
}

/**
 * Store AI report output in the semantic cache.
 */
export async function setSemanticCache<T>(query: string, data: T): Promise<void> {
    try {
        const normalizedQuery = query.trim().toLowerCase();

        // Attempt to compute a real embedding for the semantic path. If it fails, store
        // the entry with NO vector so the exact-match path still works, but this entry can
        // never produce a semantic hit computed over a fabricated embedding.
        let embedding: number[] = [];
        try {
            embedding = await generateEmbedding(query);
        } catch (err) {
            logger.warn('ai.cache.embedding_unavailable_on_store', { error: String(err) });
        }

        IN_MEMORY_CACHE.set(normalizedQuery, {
            embedding,
            data,
            createdAt: Date.now(),
        });

        // LRU eviction: remove oldest entry if over limit
        if (IN_MEMORY_CACHE.size > CACHE_MAX_ENTRIES) {
            const firstKey = IN_MEMORY_CACHE.keys().next().value;
            if (firstKey) IN_MEMORY_CACHE.delete(firstKey);
        }

        logger.info('ai.cache.stored', { cacheSize: IN_MEMORY_CACHE.size, semanticEnabled: embedding.length > 0 });
    } catch (err) {
        logger.warn('ai.cache.store_failed', { error: String(err) });
    }
}
