/**
 * @fileOverview Token Counter & Role-Based Token Budget Enforcement (TS side).
 * Mirrors `ai_service/utils/token_budget.py` so both the Python LangGraph
 * pipeline and this Next.js/Genkit pipeline enforce identical per-agent
 * context budgets.
 *
 * Unlike the Python side's `char_count / 3.8` heuristic, this uses
 * `gpt-tokenizer`'s real BPE `encode()` so the count reflects actual model
 * tokenization rather than a character-based approximation.
 */

import { encode } from 'gpt-tokenizer';

/** Per-agent-role token budgets. Mirrors `ROLE_TOKEN_BUDGETS` in the Python service. */
export const ROLE_TOKEN_BUDGETS = {
    triage_agent: 512,
    vision_agent: 1024,
    rag_specialist: 1536,
    synthesis_agent: 2048,
} as const;

export type AgentRole = keyof typeof ROLE_TOKEN_BUDGETS;

/**
 * Count the real BPE token length of a string via `gpt-tokenizer`.
 */
export function estimateTokenCount(text: string): number {
    if (!text) return 0;
    return encode(text).length;
}

/**
 * Truncate `text` to fit within `maxTokens`, preferring clean sentence
 * boundaries (splitting on ". ") and greedily accumulating sentences while
 * under budget. Falls back to a hard character-based cut (with a trailing
 * ellipsis) when a single sentence alone exceeds the budget, or when the
 * text has no sentence breaks at all.
 */
export function truncateToTokenBudget(text: string, maxTokens: number): string {
    if (!Number.isInteger(maxTokens) || maxTokens < 0) {
        throw new RangeError('maxTokens must be a non-negative integer');
    }
    if (maxTokens === 0) return '';
    if (!text) return text;

    const tokensBefore = estimateTokenCount(text);
    if (tokensBefore <= maxTokens) {
        return text;
    }

    const sentences = text.split('. ');
    let currentText = '';

    for (const sentence of sentences) {
        const candidate = currentText ? `${currentText}. ${sentence}` : sentence;
        if (estimateTokenCount(candidate) <= maxTokens) {
            currentText = candidate;
        } else {
            break;
        }
    }

    if (!currentText) {
        // Hard truncate: no single sentence fits within budget. Binary-search
        // down to a character length whose token count fits (reserving a
        // few tokens for the trailing ellipsis), rather than guessing a
        // fixed chars-per-token ratio.
        const suffix = estimateTokenCount('...') <= maxTokens ? '...' : '';
        const characters = Array.from(text);
        let low = 0;
        let high = characters.length;
        while (low < high) {
            const mid = Math.ceil((low + high + 1) / 2);
            if (estimateTokenCount(characters.slice(0, mid).join('') + suffix) <= maxTokens) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }
        currentText = characters.slice(0, low).join('') + suffix;
    }

    return currentText;
}
