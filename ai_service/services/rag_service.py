"""
RAG Vector Retrieval Service for FastAPI Microservice.
Connects to Supabase pgvector and Google Gemini text-embedding-004.
"""

import os
import math
import httpx
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_GENAI_API_KEY", "")

async def generate_embedding_python(text: str) -> List[float]:
    """Generate a real 768-dim embedding using Gemini text-embedding-004.

    Raises on failure. A pseudo-random fallback vector would make cosine search
    return meaningless "matches" that look like real retrieval — so we never
    substitute one.
    """
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not configured; cannot generate embedding")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={GEMINI_API_KEY}"
    payload = {"content": {"parts": [{"text": text}]}}

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, timeout=10.0)
        resp.raise_for_status()
        data = resp.json()

    values = data.get("embedding", {}).get("values", [])
    if not values or len(values) != 768:
        raise RuntimeError(f"Unexpected embedding dimensions: got {len(values)}, expected 768")
    return values

async def count_knowledge_chunks() -> Optional[int]:
    """Return the number of rows in medical_knowledge_chunks (grounding health).

    Returns None if Supabase is not configured or the count cannot be read.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    url = f"{SUPABASE_URL}/rest/v1/medical_knowledge_chunks?select=id"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Prefer": "count=exact",
        "Range": "0-0",
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, timeout=10.0)
            # Content-Range looks like "0-0/123"; the total is after the slash.
            content_range = resp.headers.get("content-range", "")
            if "/" in content_range:
                total = content_range.split("/")[-1]
                return int(total) if total.isdigit() else None
    except Exception:
        return None
    return None

async def search_vector_rag(query: str, category_filter: Optional[str] = None, match_count: int = 3) -> Dict[str, Any]:
    """Execute vector cosine search against Supabase pgvector.

    On failure (embedding or RPC), returns success=False with NO grounding and NO
    fabricated citations. RAG is supplementary — the diagnosis can proceed without
    it — but we never invent a source, ICD code, or similarity score.
    """
    try:
        query_vector = await generate_embedding_python(query)
    except Exception as e:
        return {
            "success": False,
            "query": query,
            "matched_chunks": [],
            "grounding_prompt_text": "",
            "error": f"Embedding unavailable, RAG grounding skipped: {e}",
        }

    rpc_url = f"{SUPABASE_URL}/rest/v1/rpc/match_medical_knowledge"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "query_embedding": query_vector,
        "match_threshold": 0.35,
        "match_count": match_count,
        "category_filter": category_filter,
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(rpc_url, json=payload, headers=headers, timeout=10.0)
            resp.raise_for_status()
            chunks = resp.json()
    except Exception as e:
        return {
            "success": False,
            "query": query,
            "matched_chunks": [],
            "grounding_prompt_text": "",
            "error": f"Vector search failed, RAG grounding skipped: {e}",
        }

    if not isinstance(chunks, list):
        chunks = []

    prompt_lines = ["GROUNDED MEDICAL LITERATURE CONTEXT:"]
    for c in chunks:
        prompt_lines.append(f"- [{c.get('title')}] (ICD-10: {c.get('icd_code', 'N/A')}): {c.get('content')} Source: {c.get('source')}")

    return {
        "success": True,
        "query": query,
        "matched_chunks": chunks,
        "grounding_prompt_text": "\n".join(prompt_lines) if chunks else "",
    }
