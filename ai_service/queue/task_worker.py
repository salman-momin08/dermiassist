"""
Redis Async Task Worker Pool for Background AI Job Processing.
Decouples heavy multi-agent synthesis and multi-photo vision analysis from HTTP requests.
Jobs transition through: queued -> processing -> completed / failed
"""

import time
import uuid
from typing import Dict, Any, Optional
from ai_service.services.orchestrator_service import run_multi_agent_pipeline

# In-Memory Job Storage Queue (Simulating Redis Task Queue)
ASYNC_JOB_STORE: Dict[str, Dict[str, Any]] = {}

async def submit_async_job(symptoms: str, image_url: Optional[str] = None, body_location: Optional[str] = None) -> Dict[str, Any]:
    """
    Submit a heavy diagnostic task to the background async worker queue.
    """
    job_id = f"job-{uuid.uuid4().hex[:8]}"
    created_at = time.time()

    ASYNC_JOB_STORE[job_id] = {
        "job_id": job_id,
        "status": "queued",  # queued | processing | completed | failed
        "created_at": created_at,
        "payload": {"symptoms": symptoms, "image_url": image_url, "body_location": body_location},
        "result": None,
        "error": None
    }

    # Process job immediately in non-blocking background simulator
    import asyncio
    asyncio.create_task(_process_job_background(job_id, symptoms, image_url, body_location))

    return {
        "success": True,
        "job_id": job_id,
        "status": "queued",
        "message": "Job queued for background multi-agent processing.",
        "poll_url": f"/api/v1/jobs/{job_id}"
    }

async def _process_job_background(job_id: str, symptoms: str, image_url: Optional[str], body_location: Optional[str]):
    """Background worker execution loop."""
    if job_id not in ASYNC_JOB_STORE:
        return

    ASYNC_JOB_STORE[job_id]["status"] = "processing"

    try:
        pipeline_res = await run_multi_agent_pipeline(symptoms, image_url, body_location)
        ASYNC_JOB_STORE[job_id]["status"] = "completed"
        ASYNC_JOB_STORE[job_id]["result"] = pipeline_res
    except Exception as e:
        ASYNC_JOB_STORE[job_id]["status"] = "failed"
        ASYNC_JOB_STORE[job_id]["error"] = str(e)

def get_job_status(job_id: str) -> Dict[str, Any]:
    """Poll background job execution status."""
    if job_id not in ASYNC_JOB_STORE:
        return {"success": False, "status": "not_found", "message": f"Job ID {job_id} not found"}

    job = ASYNC_JOB_STORE[job_id]
    return {
        "success": True,
        "job_id": job_id,
        "status": job["status"],
        "created_at": job["created_at"],
        "result": job.get("result"),
        "error": job.get("error")
    }
