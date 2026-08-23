"""
Multi-Agent Orchestrator Service for FastAPI Microservice.

Coordinates the Triage Agent (deterministic risk stratification), Vision Agent
(Hugging Face HAM10000), RAG Specialist (vector search), and the Differential
Synthesis Agent (a REAL Gemini/OpenAI call via llm_diagnosis).

The synthesis step is dynamic — the diagnosis comes from the model, never from a
hardcoded template. If the model is unavailable, the pipeline returns
success=False with the model error and NO fabricated report, so a broken model
surfaces immediately instead of being masked by canned clinical output.
"""

import time
import asyncio
from typing import Dict, Any, Optional

from ai_service.services.rag_service import search_vector_rag
from ai_service.services.huggingface_service import classify_skin_lesion_hf
from ai_service.services.llm_diagnosis import generate_differential_diagnosis


async def run_multi_agent_pipeline(
    symptoms: str,
    image_url: Optional[str] = None,
    body_location: Optional[str] = None,
    provider: str = "openai",
) -> Dict[str, Any]:
    start_time = time.time()
    trace = []

    # 1. Input Guardrail — lightweight PII redaction (not a diagnosis).
    sanitized_symptoms = symptoms.replace("SSN", "[REDACTED]").replace("credit card", "[REDACTED]")

    # 2. Triage Agent — deterministic red-flag risk stratification.
    t1 = time.time()
    triage_risk = "routine"
    if any(word in sanitized_symptoms.lower() for word in ["severe", "bleeding", "fever", "rapidly spreading"]):
        triage_risk = "urgent"
    trace.append({"agent": "TriageAgent", "duration_ms": round((time.time() - t1) * 1000, 2), "status": "completed"})

    # 3 + 4. Vision (Hugging Face) and RAG (vector search) are independent I/O —
    # run them concurrently to cut a full round-trip.
    t_parallel = time.time()
    hf_vision_result, rag_result = await asyncio.gather(
        classify_skin_lesion_hf(image_url),
        search_vector_rag(sanitized_symptoms, match_count=3),
    )
    parallel_ms = round((time.time() - t_parallel) * 1000, 2)
    trace.append({
        "agent": "HuggingFaceVisionAgent",
        "duration_ms": parallel_ms,
        "status": "completed" if hf_vision_result.get("success") else "failed",
        "model": hf_vision_result.get("model_used", "nateraw/skin-cancer-mnist-ham10000"),
    })
    trace.append({
        "agent": "RAGSpecialistAgent",
        "duration_ms": parallel_ms,
        "status": "completed" if rag_result.get("success") else "failed",
    })

    # 5. Differential Synthesis Agent — REAL dynamic model inference.
    t4 = time.time()
    # Only pass real vision findings to the diagnosis model. If the vision model
    # failed, we send nothing rather than a null/placeholder that could be read as
    # a finding.
    vision_findings = {"body_location": body_location, "image_url": image_url}
    if hf_vision_result.get("success"):
        vision_findings["top_prediction"] = hf_vision_result.get("top_prediction")
        vision_findings["vision_confidence"] = hf_vision_result.get("confidence_score")
    diagnosis = await generate_differential_diagnosis(
        symptoms=sanitized_symptoms,
        vision_findings=vision_findings,
        rag_grounding=rag_result.get("grounding_prompt_text"),
        body_location=body_location,
        preferred_provider=provider,
    )
    synth_ms = round((time.time() - t4) * 1000, 2)

    model_metadata = {
        "provider": diagnosis.get("provider"),
        "model": diagnosis.get("model"),
        "synthesis_latency_ms": diagnosis.get("latency_ms"),
        "attempts": diagnosis.get("attempts", []),
    }

    # Honest failure: model unavailable -> no diagnosis, surface the error.
    if not diagnosis.get("success"):
        trace.append({"agent": "DifferentialSynthesisAgent", "duration_ms": synth_ms, "status": "failed"})
        return {
            "success": False,
            "execution_time_ms": round((time.time() - start_time) * 1000, 2),
            "cached": False,
            "report": None,
            "model_metadata": model_metadata,
            "error": f"Diagnosis model unavailable: {diagnosis.get('error')}",
            "agent_trace": trace,
            "huggingface_vision": hf_vision_result,
        }

    trace.append({"agent": "DifferentialSynthesisAgent", "duration_ms": synth_ms, "status": "completed"})

    d = diagnosis["data"]
    rag_chunks = rag_result.get("matched_chunks", [])
    rag_grounded = bool(rag_result.get("success") and rag_chunks)
    key_findings = [
        f"Primary differential (via {diagnosis['provider']} {diagnosis['model']}): {d['condition']}",
        f"Risk Stratification: {triage_risk.upper()}",
        (
            f"RAG grounding: {len(rag_chunks)} sourced reference(s) retrieved"
            if rag_grounded
            else f"RAG grounding: none available ({rag_result.get('error', 'no matches')}) — assessment not literature-grounded"
        ),
    ]
    # Only report the vision classification if the vision model actually ran.
    if hf_vision_result.get("success"):
        key_findings.append(
            f"Hugging Face Vision Classification: {hf_vision_result.get('top_prediction')} "
            f"({hf_vision_result.get('confidence_score')}% score)"
        )
    else:
        key_findings.append(f"Vision classification unavailable: {hf_vision_result.get('error')}")
    key_findings += [f"Consider differential: {c}" for c in d.get("differential", [])]

    report = {
        "primary_condition_name": d["condition"],
        "icd_code": d["icd_code"],
        "severity": d["severity"],
        "confidence_score": float(d["confidence"]),
        "summary": d["summary"],
        "key_findings": key_findings,
        "recommended_treatments": d.get("treatment_guidelines", []),
        "dos": d.get("dos", []),
        "donts": d.get("donts", []),
        # Citations only from REAL retrieved chunks; empty when RAG was unavailable.
        "citations_used": [
            f"[{c.get('title')}] (Source: {c.get('source')}{', ICD-10: ' + c.get('icd_code') if c.get('icd_code') else ''})"
            for c in rag_chunks
        ],
        # Whether this assessment is backed by retrieved literature. The model's own
        # self-reported grounding flag is included for transparency.
        "literature_grounded": rag_grounded,
        "model_reported_grounded": bool(d.get("grounded", False)),
        "disclaimer": "INFORMATIONAL ONLY: This AI report does not constitute a formal diagnosis. Consult a licensed dermatologist.",
    }

    return {
        "success": True,
        "execution_time_ms": round((time.time() - start_time) * 1000, 2),
        "cached": False,
        "report": report,
        "model_metadata": model_metadata,
        "agent_trace": trace,
        "huggingface_vision": hf_vision_result,
    }
