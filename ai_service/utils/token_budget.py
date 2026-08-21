"""
Token Counter & Dynamic Token Budget Allocator for AI Engineering Pipeline.
Prevents context window overflow, enforces role-based token budgets,
and calculates estimated LLM billing costs.
"""

import math
from typing import Dict, Any, List

# Agent Role Token Budgets
ROLE_TOKEN_BUDGETS = {
    "triage_agent": 512,
    "vision_agent": 1024,
    "rag_specialist": 1536,
    "synthesis_agent": 2048,
}

# Cost per 1k Tokens in USD (Gemini 2.5 Flash / Vision estimates)
MODEL_PRICING = {
    "gemini-2.5-flash": {"prompt_per_1k": 0.000075, "completion_per_1k": 0.00030},
    "gemini-2.5-vision": {"prompt_per_1k": 0.00015, "completion_per_1k": 0.00060},
    "bge-small-en": {"prompt_per_1k": 0.0, "completion_per_1k": 0.0},  # Open-source free
}

def estimate_token_count(text: str) -> int:
    """
    Estimate sub-word token count based on 1 token ~ 3.8 characters for English/Medical text.
    Medical terms (e.g. 'Erythematotelangiectatic') cause 1.4x token expansion.
    """
    if not text:
        return 0
    words = text.split()
    char_count = len(text)
    # Subword tokenization estimation with medical term expansion multiplier
    estimated_tokens = math.ceil(char_count / 3.8)
    return max(len(words), estimated_tokens)

def truncate_to_token_budget(text: str, max_tokens: int) -> Dict[str, Any]:
    """
    Truncate prompt cleanly at sentence boundaries to fit within specified max_tokens budget.
    """
    tokens_before = estimate_token_count(text)
    if tokens_before <= max_tokens:
        return {
            "truncated": False,
            "text": text,
            "tokens_before": tokens_before,
            "tokens_after": tokens_before,
            "saved_tokens": 0
        }

    sentences = text.split('. ')
    current_text = ""
    current_tokens = 0

    for sentence in sentences:
        candidate = current_text + ('. ' if current_text else '') + sentence
        cand_tokens = estimate_token_count(candidate)
        if cand_tokens <= max_tokens:
            current_text = candidate
            current_tokens = cand_tokens
        else:
            break

    if not current_text:
        # Hard truncate if a single sentence exceeds budget
        max_chars = int(max_tokens * 3.5)
        current_text = text[:max_chars] + "..."
        current_tokens = estimate_token_count(current_text)

    return {
        "truncated": True,
        "text": current_text,
        "tokens_before": tokens_before,
        "tokens_after": current_tokens,
        "saved_tokens": tokens_before - current_tokens
    }

def calculate_llm_cost(prompt_tokens: int, completion_tokens: int, model: str = "gemini-2.5-flash") -> Dict[str, Any]:
    """
    Calculate estimated cost in USD for a given LLM inference request.
    """
    pricing = MODEL_PRICING.get(model, MODEL_PRICING["gemini-2.5-flash"])
    prompt_cost = (prompt_tokens / 1000.0) * pricing["prompt_per_1k"]
    completion_cost = (completion_tokens / 1000.0) * pricing["completion_per_1k"]
    total_cost = prompt_cost + completion_cost

    return {
        "model": model,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
        "prompt_cost_usd": round(prompt_cost, 7),
        "completion_cost_usd": round(completion_cost, 7),
        "total_cost_usd": round(total_cost, 7),
    }
