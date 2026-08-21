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
        logger.warn('gemini.embedding.missing_key', { message: 'GEMINI_API_KEY is not set. Using zero vector fallback.' });
        return new Array(768).fill(0);
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'models/text-embedding-004',
                    content: {
                        parts: [{ text }],
                    },
                }),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Embedding API error ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const values = data.embedding?.values as number[] | undefined;

        if (!values || !Array.isArray(values)) {
            throw new Error('Invalid embedding response format');
        }

        return values;
    } catch (error) {
        logger.error('gemini.embedding.failed', {
            error: error instanceof Error ? error.message : String(error),
        });
        // Deterministic pseudo-embedding fallback for development / offline environments
        return generateMockEmbedding(text);
    }
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
            // Keep overlap
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
