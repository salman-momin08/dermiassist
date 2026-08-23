"""
Dynamic LLM Differential Diagnosis Service (Python).

This is the single source of truth for turning symptoms (+ optional vision/RAG
context) into a structured dermatological differential using a REAL model call.

Design principles (per product decision):
  * Dynamic, not hardcoded — the condition, ICD code, severity, and guidance all
    come from the model's response, never from a canned template.
  * Transparent — every result reports exactly which provider/model produced it
    and how long it took.
  * Honest failure — if the model cannot be reached (no key, quota, timeout,
    circuit open, malformed output), we return success=False with the error and
    NO fabricated diagnosis. Callers must surface the failure rather than mask it,
    so a broken model is caught and fixed on priority instead of silently serving
    fake clinical output.

Provider order: OpenAI GPT-4o (primary) -> Google Gemini (secondary).
GPT-4o is the dedicated clinical-reasoning engine for differential diagnosis;
Gemini is kept only as a fallback so the app still returns a report if OpenAI
errors or rate-limits, rather than depending on a single always-on-call
generalist model for the diagnostic path. Both are attempted only with a
configured API key; the circuit breaker short-circuits providers that are
repeatedly failing.
"""

import os
import re
import json
import time
import logging
from typing import Dict, Any, Optional, List

import httpx
from dotenv import load_dotenv

from ai_service.utils.circuit_breaker import (
    gemini_circuit_breaker,
    CircuitBreakerOpenException,
)

load_dotenv()
logger = logging.getLogger("LLMDiagnosis")

GEMINI_API_KEY = (
    os.getenv("GEMINI_API_KEY")
    or os.getenv("GOOGLE_GENAI_API_KEY")
    or os.getenv("GOOGLE_API_KEY")
    or ""
)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

GEMINI_MODEL = "gemini-3-flash"
OPENAI_MODEL = "gpt-4o"

# Required keys the model must return for a diagnosis to count as well-formed.
_REQUIRED_FIELDS = {"condition", "icd_code", "confidence", "severity", "summary"}

_SYSTEM_INSTRUCTION = (
    "You are an expert board-certified dermatologist AI performing differential "
    "diagnosis for clinical decision-support (not a definitive diagnosis).\n\n"
    "GROUNDING & ANTI-HALLUCINATION RULES (follow strictly):\n"
    "1. Base your assessment on the patient's symptoms, any vision findings, and "
    "the GROUNDED MEDICAL LITERATURE provided in the user message.\n"
    "2. Do NOT invent facts, statistics, study results, ICD-10 codes, or sources. "
    "The `citations` you return MUST be copied verbatim from the 'Source:' lines "
    "of the provided references — never fabricate a citation. If no references are "
    "provided, return an empty citations array; do not make one up.\n"
    "3. Prefer conditions and management that are supported by the provided "
    "references. If the references do not support a confident conclusion, LOWER "
    "the confidence score accordingly and state the uncertainty in the summary.\n"
    "4. Calibrate `confidence` honestly: high (>80) only when symptoms and "
    "references clearly converge; low (<50) when evidence is sparse, ambiguous, or "
    "an image was not analyzed. When confidence is low or red-flag/urgent features "
    "are present, explicitly recommend prompt in-person evaluation by a licensed "
    "dermatologist in the summary.\n"
    "5. Never fabricate a diagnosis to appear certain. It is correct and safe to "
    "express uncertainty.\n\n"
    "Respond with STRICTLY VALID JSON only (no markdown, no prose) matching exactly "
    "this schema:\n"
    "{\n"
    '  "condition": "most likely primary condition name",\n'
    '  "icd_code": "ICD-10 code",\n'
    '  "confidence": 0-100 number,\n'
    '  "severity": "Mild" | "Moderate" | "Severe" | "Critical",\n'
    '  "summary": "concise clinical summary; state uncertainty and when to seek care",\n'
    '  "dos": ["specific care steps"],\n'
    '  "donts": ["specific things to avoid"],\n'
    '  "treatment_guidelines": ["standard treatment pathways"],\n'
    '  "differential": ["2-4 alternative conditions to consider"],\n'
    '  "citations": ["exact Source strings copied from the provided references"],\n'
    '  "grounded": true if the assessment is supported by the provided references else false\n'
    "}"
)


def _build_user_prompt(
    symptoms: str,
    vision_findings: Optional[Dict[str, Any]],
    rag_grounding: Optional[str],
    body_location: Optional[str],
) -> str:
    return (
        f"Patient symptoms: {symptoms}\n"
        f"Body location: {body_location or 'unspecified'}\n"
        f"Vision findings: {json.dumps(vision_findings or {}, ensure_ascii=False)}\n"
        f"Grounded medical literature:\n{rag_grounding or 'None provided'}\n\n"
        "Return the diagnosis JSON now:"
    )


def _sanitize_error(message: str) -> str:
    """
    Strip API keys/secrets out of an error string before it is logged or
    returned to any client. Errors from the underlying HTTP client (httpx)
    include the raw request URL/headers, which must never surface a secret —
    this is defense-in-depth on top of never putting keys in URLs.
    """
    sanitized = message
    for secret in (GEMINI_API_KEY, OPENAI_API_KEY):
        if secret:
            sanitized = sanitized.replace(secret, "[REDACTED]")
    # Catch any remaining `key=<value>` query-param style leaks (e.g. from a
    # future call site that forgets this convention).
    sanitized = re.sub(r"([?&]key=)[^&\s'\"]+", r"\1[REDACTED]", sanitized)
    return sanitized


def _extract_json(text: str) -> Dict[str, Any]:
    """Parse a JSON object from a model response, tolerating markdown fences."""
    cleaned = text.strip()
    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in cleaned:
        cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()
    return json.loads(cleaned)


def _validate_diagnosis(data: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure the model output has the required fields; raise if malformed."""
    missing = _REQUIRED_FIELDS - set(data.keys())
    if missing:
        raise ValueError(f"Model output missing required fields: {sorted(missing)}")
    # Normalize optional list fields so downstream consumers get consistent types.
    for list_field in ("dos", "donts", "treatment_guidelines", "differential", "citations"):
        val = data.get(list_field)
        if val is None:
            data[list_field] = []
        elif not isinstance(val, list):
            data[list_field] = [str(val)]
    return data


async def _call_gemini(user_prompt: str) -> Dict[str, Any]:
    """Call Gemini via the REST API. Raises on any failure."""
    # Key goes in a header, never the URL query string — httpx's auto-generated
    # error messages (and any logs/UI that surface them) include the request
    # URL verbatim, so a `?key=...` query param would leak the secret on every
    # failed call.
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    payload = {
        "system_instruction": {"parts": [{"text": _SYSTEM_INSTRUCTION}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(url, json=payload, headers={"x-goog-api-key": GEMINI_API_KEY})
        resp.raise_for_status()
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    return _validate_diagnosis(_extract_json(text))


async def _call_openai(user_prompt: str) -> Dict[str, Any]:
    """Call OpenAI Chat Completions. Raises on any failure."""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENAI_API_KEY}",
    }
    payload = {
        "model": OPENAI_MODEL,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": _SYSTEM_INSTRUCTION},
            {"role": "user", "content": user_prompt},
        ],
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions", headers=headers, json=payload
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["choices"][0]["message"]["content"]
    return _validate_diagnosis(_extract_json(text))


async def generate_differential_diagnosis(
    symptoms: str,
    vision_findings: Optional[Dict[str, Any]] = None,
    rag_grounding: Optional[str] = None,
    body_location: Optional[str] = None,
    preferred_provider: str = "openai",
) -> Dict[str, Any]:
    """
    Produce a structured differential diagnosis via a real LLM call.

    Returns a dict:
      On success:
        {
          "success": True,
          "provider": "Google Gemini" | "OpenAI",
          "model": "<model id>",
          "latency_ms": float,
          "attempts": [ {provider, model, ok, error?} , ... ],
          "data": { condition, icd_code, confidence, severity, summary,
                    dos, donts, treatment_guidelines, differential }
        }
      On failure (NO diagnosis fabricated):
        {
          "success": False,
          "provider": None,
          "model": None,
          "latency_ms": float,
          "attempts": [ ... per-provider errors ... ],
          "error": "human-readable summary of why every provider failed",
          "data": None
        }
    """
    start = time.time()
    user_prompt = _build_user_prompt(symptoms, vision_findings, rag_grounding, body_location)
    attempts: List[Dict[str, Any]] = []

    # Order providers by caller preference, but always keep the other as backup.
    provider_plan = (
        [("Google Gemini", GEMINI_MODEL), ("OpenAI", OPENAI_MODEL)]
        if preferred_provider != "openai"
        else [("OpenAI", OPENAI_MODEL), ("Google Gemini", GEMINI_MODEL)]
    )

    for provider_name, model_id in provider_plan:
        if provider_name == "Google Gemini":
            if not GEMINI_API_KEY:
                attempts.append({"provider": provider_name, "model": model_id, "ok": False, "error": "GEMINI_API_KEY not configured"})
                continue
            if not gemini_circuit_breaker.can_execute():
                attempts.append({"provider": provider_name, "model": model_id, "ok": False, "error": "circuit breaker OPEN"})
                continue
            try:
                data = await _call_gemini(user_prompt)
                gemini_circuit_breaker.record_success()
                attempts.append({"provider": provider_name, "model": model_id, "ok": True})
                return {
                    "success": True,
                    "provider": provider_name,
                    "model": model_id,
                    "latency_ms": round((time.time() - start) * 1000, 2),
                    "attempts": attempts,
                    "data": data,
                }
            except Exception as e:
                gemini_circuit_breaker.record_failure()
                safe_error = _sanitize_error(str(e))
                logger.error(f"Gemini diagnosis failed: {safe_error}")
                attempts.append({"provider": provider_name, "model": model_id, "ok": False, "error": safe_error})

        else:  # OpenAI
            if not OPENAI_API_KEY:
                attempts.append({"provider": provider_name, "model": model_id, "ok": False, "error": "OPENAI_API_KEY not configured"})
                continue
            try:
                data = await _call_openai(user_prompt)
                attempts.append({"provider": provider_name, "model": model_id, "ok": True})
                return {
                    "success": True,
                    "provider": provider_name,
                    "model": model_id,
                    "latency_ms": round((time.time() - start) * 1000, 2),
                    "attempts": attempts,
                    "data": data,
                }
            except Exception as e:
                safe_error = _sanitize_error(str(e))
                logger.error(f"OpenAI diagnosis failed: {safe_error}")
                attempts.append({"provider": provider_name, "model": model_id, "ok": False, "error": safe_error})

    # Every provider failed — surface the failure, do NOT fabricate a diagnosis.
    error_summary = "; ".join(
        f"{a['provider']}: {a.get('error', 'unknown error')}" for a in attempts if not a["ok"]
    ) or "No diagnosis provider configured"
    return {
        "success": False,
        "provider": None,
        "model": None,
        "latency_ms": round((time.time() - start) * 1000, 2),
        "attempts": attempts,
        "error": error_summary,
        "data": None,
    }
