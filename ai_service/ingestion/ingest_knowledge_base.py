"""
DermiAssist-AI: RAG Knowledge Base Ingestion Pipeline.

Reads the curated, sourced dermatology knowledge base
(src/ai/rag/datasets/dermatology-knowledge-base.json), generates a REAL Gemini
text-embedding-004 vector for each entry, and upserts it into the Supabase
pgvector table `medical_knowledge_chunks`.

This is what makes RAG grounding real: the diagnosis model retrieves these
genuine, attributable references instead of hallucinating. The pipeline is:
  * Idempotent — each entry gets a deterministic UUID (uuid5 of its stable id),
    so re-running updates in place rather than duplicating.
  * Honest — it requires real GEMINI + Supabase credentials and reports exactly
    how many rows embedded/upserted succeeded or failed. It never inserts a row
    with a fake/zero vector.

Usage:
    python -m ai_service.ingestion.ingest_knowledge_base
"""

import os
import json
import uuid
import asyncio
import logging
from typing import List, Dict, Any

import httpx
from dotenv import load_dotenv

from ai_service.services.rag_service import generate_embedding_python

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("KnowledgeBaseIngestion")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

# Stable namespace so the same knowledge-base id always maps to the same row UUID.
_KB_NAMESPACE = uuid.UUID("6f7a1e2c-9b3d-4c5e-8a10-1f2e3d4c5b6a")

_KB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "src", "ai", "rag", "datasets", "dermatology-knowledge-base.json",
)


def load_knowledge_base() -> List[Dict[str, Any]]:
    with open(_KB_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


async def _upsert_row(client: httpx.AsyncClient, row: Dict[str, Any]) -> None:
    """Upsert a single row into medical_knowledge_chunks (merge on primary key)."""
    url = f"{SUPABASE_URL}/rest/v1/medical_knowledge_chunks?on_conflict=id"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    resp = await client.post(url, json=[row], headers=headers)
    resp.raise_for_status()


async def ingest() -> Dict[str, Any]:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("Supabase URL / service key not configured; cannot ingest knowledge base")

    entries = load_knowledge_base()
    logger.info(f"Loaded {len(entries)} knowledge-base entries from {_KB_PATH}")

    succeeded, failed = 0, 0
    errors: List[str] = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        for entry in entries:
            kb_id = entry["id"]
            try:
                # Embed content + lay-term keywords so the vector matches both
                # clinical and everyday phrasing. The vector must be real or we skip.
                keywords = entry.get("keywords", [])
                embed_text = entry["content"]
                if keywords:
                    embed_text += "\nCommon terms: " + ", ".join(keywords)
                embedding = await generate_embedding_python(embed_text)
                row = {
                    "id": str(uuid.uuid5(_KB_NAMESPACE, kb_id)),
                    "title": entry["title"],
                    "condition_category": entry["conditionCategory"],
                    "content": entry["content"],
                    "source": entry["source"],
                    "icd_code": entry.get("icdCode"),
                    "metadata": {"kb_id": kb_id, "keywords": keywords},
                    "embedding": embedding,
                }
                await _upsert_row(client, row)
                succeeded += 1
                logger.info(f"Upserted: {kb_id}")
            except Exception as e:
                failed += 1
                msg = f"{kb_id}: {e}"
                errors.append(msg)
                logger.error(f"Failed to ingest {msg}")

    result = {"total": len(entries), "succeeded": succeeded, "failed": failed, "errors": errors}
    logger.info(f"Ingestion complete: {succeeded} succeeded, {failed} failed")
    return result


if __name__ == "__main__":
    outcome = asyncio.run(ingest())
    if outcome["failed"] > 0:
        # Non-zero exit so CI / operators notice a partial or failed ingestion.
        raise SystemExit(f"Knowledge-base ingestion had {outcome['failed']} failure(s): {outcome['errors']}")
