/**
 * @fileOverview Medical RAG Retriever module for DermiAssist-AI.
 * Performs dense vector search + metadata filtering + reranking + citation formatting.
 */

import { generateEmbedding } from './embeddings';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import knowledgeBase from './datasets/dermatology-knowledge-base.json';

export interface RetrievedMedicalChunk {
    id: string;
    title: string;
    conditionCategory: string;
    content: string;
    source: string;
    icdCode?: string;
    /**
     * Cosine similarity from the pgvector search, or `null` for in-memory keyword
     * fallback matches (which are NOT cosine-scored and must not be presented as
     * ranked vector matches).
     */
    similarity: number | null;
    formattedCitation: string;
    /** True when this chunk came from the in-memory keyword fallback, not pgvector. */
    isFallback?: boolean;
}

export interface RAGSearchOptions {
    query: string;
    categoryFilter?: string;
    matchThreshold?: number;
    matchCount?: number;
}

/**
 * Curated, sourced dermatology knowledge base used for local/fallback RAG
 * retrieval. This is the SAME real, attributable content ingested into pgvector
 * (see ai_service/ingestion/ingest_knowledge_base.py), loaded from a single
 * shared JSON so the primary (vector) and fallback (keyword) paths never drift.
 */
interface KnowledgeBaseEntry {
    id: string;
    title: string;
    conditionCategory: string;
    icdCode?: string;
    source: string;
    content: string;
    keywords?: string[];
}
const IN_MEMORY_MEDICAL_KNOWLEDGE: KnowledgeBaseEntry[] = knowledgeBase as KnowledgeBaseEntry[];

/**
 * Ubiquitous derm terms that appear in almost every entry and therefore carry no
 * discriminating signal for keyword matching. Excluded from fallback scoring so
 * specific presentation terms dominate (avoids e.g. grounding "acne" on "tinea"
 * just because both mention "skin").
 */
const GENERIC_STOPWORDS = new Set([
    'skin', 'rash', 'rashes', 'lesion', 'lesions', 'condition', 'area', 'areas',
    'patch', 'patches', 'spot', 'spots', 'affected', 'weeks', 'week', 'days',
    'month', 'months', 'symptom', 'symptoms', 'body', 'chronic', 'acute',
]);

/**
 * Retrieve grounded medical context for a diagnostic or user query.
 */
export async function retrieveMedicalContext(
    options: RAGSearchOptions
): Promise<{
    chunks: RetrievedMedicalChunk[];
    groundingPromptText: string;
    sources: string[];
}> {
    const {
        query,
        categoryFilter,
        matchThreshold = 0.5,
        matchCount = 4,
    } = options;

    logger.info('rag.search.started', { query, categoryFilter });

    // Step 1: Generate vector embedding for the query. If embedding generation fails
    // (e.g. missing API key), we do NOT fabricate a vector — we skip the pgvector path
    // and degrade to real in-memory keyword matching below.
    let queryEmbedding: number[] | null = null;
    try {
        queryEmbedding = await generateEmbedding(query);
    } catch (err) {
        logger.warn('rag.embedding_unavailable', {
            error: err instanceof Error ? err.message : String(err),
        });
    }

    let chunks: RetrievedMedicalChunk[] = [];

    if (queryEmbedding) {
        try {
            // Attempt Supabase pgvector search
            const supabase = await createServerClient();
            const { data, error } = await supabase.rpc('match_medical_knowledge', {
                query_embedding: queryEmbedding,
                match_threshold: matchThreshold,
                match_count: matchCount,
                category_filter: categoryFilter ?? null,
            });

            if (!error && data && data.length > 0) {
                chunks = data.map((item: {
                    id: string;
                    title: string;
                    condition_category: string;
                    content: string;
                    source: string;
                    icd_code?: string;
                    similarity: number;
                }) => ({
                    id: item.id,
                    title: item.title,
                    conditionCategory: item.condition_category,
                    content: item.content,
                    source: item.source,
                    icdCode: item.icd_code,
                    similarity: item.similarity,
                    formattedCitation: `[Source: ${item.source} ${item.icd_code ? `(ICD-10: ${item.icd_code})` : ''}]`,
                }));
            }
        } catch (err) {
            logger.warn('rag.supabase.query_fallback', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    // Fallback: In-memory keyword-overlap matching if the vector DB returns no results.
    if (chunks.length === 0) {
        // Tokenize the query into meaningful terms (drop short and generic tokens).
        const queryLower = query.toLowerCase();
        const queryTerms = Array.from(
            new Set(
                queryLower
                    .split(/[^a-z0-9]+/)
                    .filter((t) => t.length >= 4 && !GENERIC_STOPWORDS.has(t))
            )
        );

        const scored = IN_MEMORY_MEDICAL_KNOWLEDGE
            .filter((item) => !categoryFilter || item.conditionCategory.toLowerCase() === categoryFilter.toLowerCase())
            .map((item) => {
                const haystack = `${item.title} ${item.conditionCategory} ${item.content}`.toLowerCase();
                // Base score: distinct query terms appearing in the entry text.
                let score = queryTerms.reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0);
                // Boost: curated lay-term keywords found in the query are strong,
                // condition-specific signals — weight them higher than generic text hits.
                for (const kw of item.keywords ?? []) {
                    if (queryLower.includes(kw.toLowerCase())) score += 3;
                }
                return { item, score };
            })
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, matchCount);

        // Only surface entries that actually matched the query terms. We never
        // backfill unrelated entries — an unmatched query yields no grounding
        // rather than misleading references.
        chunks = scored.map(({ item }) => ({
            id: item.id,
            title: item.title,
            conditionCategory: item.conditionCategory,
            content: item.content,
            source: item.source,
            icdCode: item.icdCode,
            // In-memory keyword matches are NOT cosine-scored — do not fabricate a score.
            similarity: null,
            isFallback: true,
            formattedCitation: `[Reference (in-memory keyword match): ${item.source}${item.icdCode ? ` (ICD-10: ${item.icdCode})` : ''}]`,
        }));
    }

    // Step 2: Format grounded text for LLM Prompt injection
    const groundingPromptText = chunks
        .map(
            (c, i) =>
                `--- MEDICAL REFERENCE [${i + 1}] ---\nTitle: ${c.title}\nSource: ${c.source}\nContent: ${c.content}\nCitation Tag: ${c.formattedCitation}`
        )
        .join('\n\n');

    const sources = Array.from(new Set(chunks.map((c) => c.source)));

    logger.info('rag.search.completed', {
        retrievedCount: chunks.length,
        sourcesCount: sources.length,
    });

    return {
        chunks,
        groundingPromptText,
        sources,
    };
}
