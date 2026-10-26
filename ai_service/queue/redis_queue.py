"""
Redis-backed Async Job Queue for Background AI Job Processing (Upstash REST API).

Replaces the previous in-memory ASYNC_JOB_STORE dict in queue/task_worker.py
(that module's own docstring admitted it was "Simulating Redis Task Queue" —
no real Redis, no durability, jobs vanished on process restart). This module
talks to Upstash Redis's REST API over plain httpx, matching this service's
existing no-SDK style (see rag_service.py's raw REST calls to Supabase despite
the `supabase` package being listed in requirements.txt).

Env vars (shared with the Next.js side of this project — see src/lib/redis/client.ts):
  UPSTASH_REDIS_REST_URL
  UPSTASH_REDIS_REST_TOKEN

Fail-CLOSED, not fail-open: unlike the Next.js rate limiter (which fails open
when Redis is unavailable — see safeRedisOperation), a job queue that silently
loses durability guarantees without telling anyone is worse than refusing to
accept jobs. If these env vars aren't configured, job submission and the
background worker both refuse to run rather than silently falling back to an
in-memory store.

Upstash's REST API has no blocking Redis commands (no BLPOP) over plain HTTP,
so the background worker below is a polling-based dequeue (RPOP every ~1s when
the queue is empty) — not a true blocking dequeue. This is called out honestly
rather than pretending it's push-based.

Jobs transition through: queued -> processing -> completed / failed
"""

import os
import json
import time
import uuid
import asyncio
import secrets
import logging
from typing import Dict, Any, Optional, List

import httpx
from dotenv import load_dotenv

from ai_service.services.orchestrator_service import run_multi_agent_pipeline

load_dotenv()
logger = logging.getLogger("RedisQueue")

UPSTASH_REDIS_REST_URL = os.getenv("UPSTASH_REDIS_REST_URL", "").rstrip("/")
UPSTASH_REDIS_REST_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")

_JOB_QUEUE_KEY = "job_queue"
_JOB_HASH_PREFIX = "job:"
_JOB_TTL_SECONDS = 86400  # 24h — no expiry existed in the old in-memory store either way
_POLL_INTERVAL_SECONDS = 1.0


class RedisNotConfiguredError(RuntimeError):
    """Raised when Upstash Redis env vars are missing. Fail closed, not open."""
    pass


def is_redis_configured() -> bool:
    return bool(UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN)


def _pairs_to_dict(flat: Optional[List[Any]]) -> Dict[str, str]:
    """Upstash's HGETALL result is a flat [field, value, field, value, ...] array
    (mirroring raw RESP), not a JSON object — convert it to a dict."""
    if not flat:
        return {}
    return {str(flat[i]): flat[i + 1] for i in range(0, len(flat) - 1, 2)}


async def _redis_command(*command: Any) -> Any:
    """Execute a single Redis command via Upstash's REST API (POST body = JSON command array)."""
    if not is_redis_configured():
        raise RedisNotConfiguredError(
            "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not configured; "
            "refusing to run the job queue without durable storage"
        )
    headers = {
        "Authorization": f"Bearer {UPSTASH_REDIS_REST_TOKEN}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(UPSTASH_REDIS_REST_URL, headers=headers, json=list(command), timeout=10.0)
        resp.raise_for_status()
        data = resp.json()
    if isinstance(data, dict) and data.get("error"):
        raise RuntimeError(f"Redis command {command[0] if command else '?'} failed: {data['error']}")
    return data.get("result") if isinstance(data, dict) else data


async def _redis_pipeline(commands: List[List[Any]]) -> List[Any]:
    """Execute a batch of Redis commands via Upstash's REST /pipeline endpoint,
    in a single HTTP round trip. Returns the list of per-command result objects
    (each `{"result": ...}` or `{"error": ...}`), in order."""
    if not is_redis_configured():
        raise RedisNotConfiguredError(
            "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not configured; "
            "refusing to run the job queue without durable storage"
        )
    headers = {
        "Authorization": f"Bearer {UPSTASH_REDIS_REST_TOKEN}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{UPSTASH_REDIS_REST_URL}/pipeline", headers=headers, json=commands, timeout=10.0)
        resp.raise_for_status()
        results = resp.json()
    if not isinstance(results, list):
        raise RuntimeError(f"Unexpected pipeline response shape: {str(results)[:200]}")
    for cmd, result in zip(commands, results):
        if isinstance(result, dict) and result.get("error"):
            raise RuntimeError(f"Redis pipeline command {cmd[0] if cmd else '?'} failed: {result['error']}")
    return results


async def submit_async_job(job_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Submit a heavy diagnostic task to the durable Redis-backed job queue.

    Raises RedisNotConfiguredError if Upstash isn't configured — the caller
    (main.py) turns this into a clear 503, rather than silently accepting a job
    that will never be durably queued.
    """
    job_id = f"job-{uuid.uuid4().hex[:8]}"
    # Returned only to the submitter and required again to poll status, so a
    # guessed/observed job_id alone can't be used to read someone else's
    # diagnostic result (symptoms, image URL, synthesized diagnosis).
    owner_token = secrets.token_urlsafe(24)
    created_at = time.time()
    hash_key = f"{_JOB_HASH_PREFIX}{job_id}"

    metadata_fields = [
        "status", "queued",
        "job_type", job_type,
        "payload", json.dumps(payload, ensure_ascii=False),
        "owner_token", owner_token,
        "created_at", str(created_at),
        "result", "",
        "error", "",
    ]

    await _redis_pipeline([
        ["HSET", hash_key, *metadata_fields],
        ["EXPIRE", hash_key, str(_JOB_TTL_SECONDS)],
        ["RPUSH", _JOB_QUEUE_KEY, job_id],
    ])

    return {
        "success": True,
        "job_id": job_id,
        "owner_token": owner_token,
        "status": "queued",
        "message": "Job queued for background multi-agent processing (Upstash Redis).",
        "poll_url": f"/api/v1/jobs/{job_id}?owner_token={owner_token}",
    }


async def get_job_status(job_id: str, owner_token: str = "") -> Dict[str, Any]:
    """Poll background job execution status. Requires the owner_token issued at submit time."""
    if not is_redis_configured():
        return {
            "success": False,
            "status": "error",
            "message": "Job queue not configured (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN missing)",
        }

    try:
        raw = await _redis_command("HGETALL", f"{_JOB_HASH_PREFIX}{job_id}")
    except Exception as e:
        return {"success": False, "status": "error", "message": f"Failed to read job status: {e}"}

    job = _pairs_to_dict(raw)
    if not job:
        return {"success": False, "status": "not_found", "message": f"Job ID {job_id} not found"}

    # Constant-time comparison — a guessed job_id alone shouldn't leak whether
    # it exists faster than a wrong-token response, and shouldn't be readable
    # without the token issued at submit time.
    stored_owner_token = job.get("owner_token", "")
    if not secrets.compare_digest(stored_owner_token, owner_token or ""):
        return {"success": False, "status": "forbidden", "message": "Invalid or missing owner_token for this job"}

    result_raw = job.get("result", "")
    result = json.loads(result_raw) if result_raw else None

    return {
        "success": True,
        "job_id": job_id,
        "status": job.get("status", "unknown"),
        "created_at": float(job["created_at"]) if job.get("created_at") else None,
        "result": result,
        "error": job.get("error") or None,
    }


async def _update_job(job_id: str, **fields: Any) -> None:
    hash_key = f"{_JOB_HASH_PREFIX}{job_id}"
    flat: List[str] = []
    for k, v in fields.items():
        flat.append(k)
        flat.append(v if isinstance(v, str) else json.dumps(v, ensure_ascii=False))
    await _redis_command("HSET", hash_key, *flat)


async def _process_job(job_id: str, job: Dict[str, str]) -> None:
    """Run the actual background work for one job and write the result back to Redis."""
    job_type = job.get("job_type", "")
    try:
        payload = json.loads(job.get("payload") or "{}")
    except Exception:
        logger.exception("Invalid payload for job %s", job_id)
        await _update_job(job_id, status="failed", error="Invalid job payload")
        return

    await _update_job(job_id, status="processing")

    try:
        if job_type == "diagnostic_analysis":
            pipeline_res = await run_multi_agent_pipeline(
                symptoms=payload.get("symptoms", ""),
                image_url=payload.get("image_url"),
                body_location=payload.get("body_location"),
                provider=payload.get("provider", "huggingface"),
            )
        else:
            raise ValueError(f"Unknown job_type: {job_type}")

        if not pipeline_res.get("success"):
            raise RuntimeError(pipeline_res.get("error") or "Diagnostic pipeline failed")
        await _update_job(job_id, status="completed", result=json.dumps(pipeline_res, ensure_ascii=False), error="")
    except Exception as e:
        logger.error(f"[RedisQueue] Job {job_id} failed: {e}")
        await _update_job(job_id, status="failed", error=str(e))


async def run_worker_loop() -> None:
    """
    Background worker coroutine — started once via asyncio.create_task at
    FastAPI startup (see main.py's startup handler).

    Polls the queue every ~1s when empty. Upstash's REST API has no blocking
    dequeue over plain HTTP (no BLPOP), so this is honestly a polling-based
    worker, not a true blocking dequeue.
    """
    if not is_redis_configured():
        logger.warning(
            "[RedisQueue] UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not configured — "
            "background job worker will not start. Job submission will fail with a clear error."
        )
        return

    logger.info(f"[RedisQueue] Background job worker started (polling every {_POLL_INTERVAL_SECONDS}s).")
    while True:
        try:
            job_id = await _redis_command("LPOP", _JOB_QUEUE_KEY)
        except Exception as e:
            logger.error(f"[RedisQueue] Failed to poll job queue: {e}")
            await asyncio.sleep(_POLL_INTERVAL_SECONDS)
            continue

        if not job_id:
            await asyncio.sleep(_POLL_INTERVAL_SECONDS)
            continue

        try:
            raw = await _redis_command("HGETALL", f"{_JOB_HASH_PREFIX}{job_id}")
            job = _pairs_to_dict(raw)
            if not job:
                logger.warning(f"[RedisQueue] Job {job_id} popped from queue but metadata missing (expired?) — skipping.")
                continue
            await _process_job(job_id, job)
        except Exception as e:
            logger.error(f"[RedisQueue] Unhandled error processing job {job_id}: {e}")


_worker_task: Optional["asyncio.Task[None]"] = None


def start_worker() -> None:
    """Start the background worker task once (idempotent). Call from FastAPI startup."""
    global _worker_task
    if _worker_task is not None and not _worker_task.done():
        return
    _worker_task = asyncio.create_task(run_worker_loop())
