/**
 * @fileOverview RAG Specialist Agent.
 * Queries vector database for medical literature, clinical guidelines, and ICD-10 codes,
 * synthesizing grounded reference context with citations.
 */

import { retrieveMedicalContext, RetrievedMedicalChunk } from '@/ai/rag/retriever';
import { logger } from '@/lib/logger';
import { ROLE_TOKEN_BUDGETS, truncateToTokenBudget } from '@/ai/utils/token-budget';

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
    
    logger.info('agent.rag.started', { queryLength: primaryQuery.length });

    const retrievalResult = await retrieveMedicalContext({
        query: primaryQuery,
        matchCount: 4,
        matchThreshold: 0.45,
    });

    // Enforce the rag_specialist token budget on the grounded context text
    // before it is handed to the synthesis agent's prompt, mirroring the
    // Python pipeline's ROLE_TOKEN_BUDGETS (ai_service/utils/token_budget.py).
    const groundedContextPrompt = truncateToTokenBudget(
        retrievalResult.groundingPromptText,
        ROLE_TOKEN_BUDGETS.rag_specialist
    );

    logger.info('agent.rag.completed', {
        chunksRetrieved: retrievalResult.chunks.length,
        sourcesCount: retrievalResult.sources.length,
        groundingTextTruncated: groundedContextPrompt.length !== retrievalResult.groundingPromptText.length,
    });

    return {
        retrievedChunks: retrievalResult.chunks,
        groundedContextPrompt,
        clinicalCitations: retrievalResult.sources,
    };
}
