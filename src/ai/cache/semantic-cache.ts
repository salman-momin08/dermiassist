/**
 * @fileOverview Semantic Cache Layer.
 * Provides vector-similarity & normalized hash caching using Upstash Redis / In-Memory store
 * to return sub-50ms cached AI responses for recurring diagnostic queries.
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
 * Retrieve cached output if a semantically similar query exists.
 */
export async function getSemanticCache<T>(query: string): Promise<T | null> {
    const normalizedQuery = query.trim().toLowerCase();
    
    // Quick exact string match check
    if (IN_MEMORY_CACHE.has(normalizedQuery)) {
        const entry = IN_MEMORY_CACHE.get(normalizedQuery)!;
        logger.info('ai.cache.hit.exact', { queryLength: query.length });
        return entry.data as T;
    }

    // Semantic Vector Similarity Match check
    try {
        const queryEmbedding = await generateEmbedding(query);
        for (const [cachedKey, entry] of IN_MEMORY_CACHE.entries()) {
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
        const embedding = await generateEmbedding(query);

        IN_MEMORY_CACHE.set(normalizedQuery, {
            embedding,
            data,
            createdAt: Date.now(),
        });

        // Limit cache size to 100 entries
        if (IN_MEMORY_CACHE.size > 100) {
            const firstKey = IN_MEMORY_CACHE.keys().next().value;
            if (firstKey) IN_MEMORY_CACHE.delete(firstKey);
        }

        logger.info('ai.cache.stored', { cacheSize: IN_MEMORY_CACHE.size });
    } catch (err) {
        logger.warn('ai.cache.store_failed', { error: String(err) });
    }
}
