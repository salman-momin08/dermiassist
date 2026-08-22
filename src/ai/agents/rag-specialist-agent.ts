/**
 * @fileOverview RAG Specialist Agent.
 * Queries vector database for medical literature, clinical guidelines, and ICD-10 codes,
 * synthesizing grounded reference context with citations.
 */

import { retrieveMedicalContext, RetrievedMedicalChunk } from '@/ai/rag/retriever';
import { logger } from '@/lib/logger';

export interface RAGAgentInput {
    suspectedConditions: string[];
    symptomsDescription: string;
}

export interface RAGAgentOutput {
    retrievedChunks: RetrievedMedicalChunk[];
    groundedContextPrompt: string;
    clinicalCitations: string[];
}

export async function runRAGSpecialistAgent(input: RAGAgentInput): Promise<RAGAgentOutput> {
    const primaryQuery = `${input.suspectedConditions.join(' ')} ${input.symptomsDescription}`.trim();
    
    logger.info('agent.rag.started', { primaryQuery });

    const retrievalResult = await retrieveMedicalContext({
        query: primaryQuery,
        matchCount: 4,
        matchThreshold: 0.45,
    });

    logger.info('agent.rag.completed', {
        chunksRetrieved: retrievalResult.chunks.length,
        sourcesCount: retrievalResult.sources.length,
    });

    return {
        retrievedChunks: retrievalResult.chunks,
        groundedContextPrompt: retrievalResult.groundingPromptText,
        clinicalCitations: retrievalResult.sources,
    };
}
