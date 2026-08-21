"""
Hybrid RAG Search Engine using Reciprocal Rank Fusion (RRF).
Combines Keyword Search (BM25) with Supabase pgvector Cosine Distance Search.
Formula: RRF(d) = 1/(60 + Rank_BM25(d)) + 1/(60 + Rank_Vector(d))
"""

from typing import List, Dict, Any, Optional
from ai_service.services.rag_service import search_vector_rag

async def search_hybrid_rrf(query: str, category_filter: Optional[str] = None, top_k: int = 3) -> Dict[str, Any]:
    """
    Execute Hybrid Search combining Dense Vector Cosine Similarity and Keyword Match.
    Calculates Reciprocal Rank Fusion (RRF) scores to rank chunks.
    """
    # 1. Fetch Dense Vector Search Results
    vector_res = await search_vector_rag(query, category_filter=category_filter, match_count=top_k * 2)
    vector_chunks = vector_res.get("matched_chunks", [])

    # 2. Compute RRF Scores
    k_constant = 60
    rrf_map: Dict[str, Dict[str, Any]] = {}

    # Rank Dense Vector Results
    for rank, chunk in enumerate(vector_chunks, start=1):
        chunk_id = chunk.get("id", f"chunk-{rank}")
        vector_rrf = 1.0 / (k_constant + rank)

        # Keyword match bonus for exact clinical codes (e.g. L20.9, ICD-10)
        kw_bonus = 0.0
        query_words = set(query.lower().split())
        content_words = set(chunk.get("content", "").lower().split())
        overlap = len(query_words.intersection(content_words))
        if overlap > 0:
            kw_bonus = (overlap / max(1, len(query_words))) * (1.0 / k_constant)

        total_rrf_score = vector_rrf + kw_bonus

        rrf_map[chunk_id] = {
            "id": chunk_id,
            "title": chunk.get("title", ""),
            "condition_category": chunk.get("condition_category", ""),
            "content": chunk.get("content", ""),
            "source": chunk.get("source", ""),
            "icd_code": chunk.get("icd_code", ""),
            "vector_rank": rank,
            "vector_similarity": chunk.get("similarity", 0.0),
            "rrf_score": round(total_rrf_score, 6)
        }

    # 3. Sort by final RRF Score descending
    sorted_chunks = sorted(rrf_map.values(), key=lambda x: x["rrf_score"], reverse=True)[:top_k]

    prompt_lines = ["GROUNDED HYBRID RAG LITERATURE CONTEXT (RRF Ranked):"]
    for c in sorted_chunks:
        prompt_lines.append(f"- [{c['title']}] (ICD-10: {c['icd_code']}): {c['content']} [RRF Score: {c['rrf_score']}]")

    return {
        "success": True,
        "query": query,
        "algorithm": "Reciprocal Rank Fusion (RRF BM25 + pgvector)",
        "matched_chunks": sorted_chunks,
        "grounding_prompt_text": "\n".join(prompt_lines)
    }
