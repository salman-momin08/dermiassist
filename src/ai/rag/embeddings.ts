/**
 * @fileOverview Embedding generator and text chunking utilities for RAG.
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

/**
 * Generate 768-dimensional vector embedding for text using Google Gemini Embedding API.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
        logger.warn('gemini.embedding.missing_key', { message: 'GEMINI_API_KEY is not set. Using pseudo-vector fallback.' });
        return generateMockEmbedding(text);
    }

    // Try text-embedding-004 first, fallback to embedding-001
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
                // Ensure vector length is padded or normalized to 768 dimensions
                if (values.length === 768) return values;
                if (values.length < 768) {
                    return [...values, ...new Array(768 - values.length).fill(0)];
                }
                return values.slice(0, 768);
            }
        } catch {
            // Try next model
        }
    }

    logger.warn('gemini.embedding.fallback', { message: 'Using deterministic pseudo-embedding fallback.' });
    return generateMockEmbedding(text);
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
