"""
Hybrid RAG Search Engine using Reciprocal Rank Fusion (RRF).
Combines a genuinely independent Postgres full-text (BM25-style) keyword search
with Supabase pgvector Cosine Distance Search.
Formula: RRF(d) = 1/(60 + Rank_BM25(d)) + 1/(60 + Rank_Vector(d))

Both ranked lists are real, independently-computed rankings (not a keyword-overlap
bonus layered on top of the vector list) — see supabase_migrations/35_fulltext_search_bm25.sql
for the `search_bm25_medical_knowledge` RPC this module calls.
"""

import asyncio
import httpx
from typing import List, Dict, Any, Optional

from ai_service.services.rag_service import search_vector_rag, SUPABASE_URL, SUPABASE_KEY

_RRF_K = 60


async def _search_bm25(query: str, category_filter: Optional[str] = None, match_count: int = 6) -> Dict[str, Any]:
    """
    Execute the real Postgres full-text-search (BM25-style ts_rank_cd) RPC.

    Same call pattern as `search_vector_rag`'s RPC call in rag_service.py — POST
    to the Supabase RPC REST endpoint with the same apikey/Authorization headers.
    On failure, returns success=False with no fabricated ranking.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        return {"success": False, "chunks": [], "error": "Supabase not configured"}

    rpc_url = f"{SUPABASE_URL}/rest/v1/rpc/search_bm25_medical_knowledge"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "query_text": query,
        "match_count": match_count,
        "category_filter": category_filter,
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(rpc_url, json=payload, headers=headers, timeout=10.0)
            resp.raise_for_status()
            chunks = resp.json()
    except Exception as e:
        return {"success": False, "chunks": [], "error": f"BM25 keyword search failed: {e}"}

    if not isinstance(chunks, list):
        chunks = []

    return {"success": True, "chunks": chunks, "error": None}


async def search_hybrid_rrf(query: str, category_filter: Optional[str] = None, top_k: int = 3) -> Dict[str, Any]:
    """
    Execute Hybrid Search combining two REAL, independently-ranked lists:
      1. Dense vector cosine similarity search (search_vector_rag).
      2. Postgres full-text keyword search (search_bm25_medical_knowledge, a
         genuine BM25-style ts_rank_cd ranking — not a keyword-overlap bonus).

    Fuses them with real Reciprocal Rank Fusion: for each unique chunk id, sums
    1/(60 + rank_position) across every list the chunk appears in. A chunk that
    appears in both lists gets both terms added; a chunk in only one list gets
    only that list's term.

    Honest failure: if BOTH searches fail, returns success=False with no
    fabricated results. If only one fails, the other's real ranking is still used
    (partial degradation, not silent fabrication).
    """
    fetch_count = max(top_k * 2, top_k + 3)

    # Two genuinely independent searches, run concurrently.
    vector_res, bm25_res = await asyncio.gather(
        search_vector_rag(query, category_filter=category_filter, match_count=fetch_count),
        _search_bm25(query, category_filter=category_filter, match_count=fetch_count),
    )

    vector_ok = bool(vector_res.get("success"))
    bm25_ok = bool(bm25_res.get("success"))

    if not vector_ok and not bm25_ok:
        return {
            "success": False,
            "query": query,
            "algorithm": "Reciprocal Rank Fusion (BM25 + pgvector)",
            "matched_chunks": [],
            "grounding_prompt_text": "",
            "error": f"Both search paths failed. Vector: {vector_res.get('error')}; BM25: {bm25_res.get('error')}",
        }

    vector_chunks = vector_res.get("matched_chunks", []) if vector_ok else []
    bm25_chunks = bm25_res.get("chunks", []) if bm25_ok else []

    rrf_map: Dict[str, Dict[str, Any]] = {}

    # Rank 1: dense vector cosine similarity list (1-indexed).
    for rank, chunk in enumerate(vector_chunks, start=1):
        chunk_id = str(chunk.get("id", f"vec-{rank}"))
        entry = rrf_map.setdefault(chunk_id, {
            "id": chunk_id,
            "title": chunk.get("title", ""),
            "condition_category": chunk.get("condition_category", ""),
            "content": chunk.get("content", ""),
            "source": chunk.get("source", ""),
            "icd_code": chunk.get("icd_code", ""),
            "vector_rank": None,
            "vector_similarity": None,
            "bm25_rank": None,
            "bm25_ts_rank": None,
            "rrf_score": 0.0,
        })
        entry["vector_rank"] = rank
        entry["vector_similarity"] = chunk.get("similarity", 0.0)
        entry["rrf_score"] += 1.0 / (_RRF_K + rank)

    # Rank 2: independent Postgres full-text (BM25-style) ranked list (1-indexed).
    for chunk in bm25_chunks:
        chunk_id = str(chunk.get("id", ""))
        rank = chunk.get("rank_position")
        if not chunk_id or not rank:
            continue
        entry = rrf_map.setdefault(chunk_id, {
            "id": chunk_id,
            "title": chunk.get("title", ""),
            "condition_category": chunk.get("condition_category", ""),
            "content": chunk.get("content", ""),
            "source": chunk.get("source", ""),
            "icd_code": chunk.get("icd_code", ""),
            "vector_rank": None,
            "vector_similarity": None,
            "bm25_rank": None,
            "bm25_ts_rank": None,
            "rrf_score": 0.0,
        })
        entry["bm25_rank"] = rank
        entry["bm25_ts_rank"] = chunk.get("ts_rank", 0.0)
        entry["rrf_score"] += 1.0 / (_RRF_K + rank)

    for entry in rrf_map.values():
        entry["rrf_score"] = round(entry["rrf_score"], 6)

    sorted_chunks = sorted(rrf_map.values(), key=lambda x: x["rrf_score"], reverse=True)[:top_k]

    prompt_lines = ["GROUNDED HYBRID RAG LITERATURE CONTEXT (RRF Ranked):"]
    for c in sorted_chunks:
        prompt_lines.append(f"- [{c['title']}] (ICD-10: {c['icd_code']}): {c['content']} [RRF Score: {c['rrf_score']}]")

    return {
        "success": True,
        "query": query,
        "algorithm": "Reciprocal Rank Fusion (BM25 + pgvector)",
        "matched_chunks": sorted_chunks,
        "grounding_prompt_text": "\n".join(prompt_lines) if sorted_chunks else "",
        "vector_search_ok": vector_ok,
        "bm25_search_ok": bm25_ok,
    }
