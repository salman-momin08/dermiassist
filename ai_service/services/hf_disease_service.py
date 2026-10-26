"""
Hugging Face Structured Disease Analysis Service for the FastAPI microservice.

Provides deep clinical reasoning and differential diagnosis as strict JSON using
an open-source instruct model through Hugging Face Inference Providers. On any
failure (missing token, rate limit, malformed output) it returns an honest
failure envelope with NO fabricated diagnosis, per the project's
no-fake-fallbacks rule.
"""

import json
import logging
from typing import Dict, Any, Optional

from dotenv import load_dotenv

from ai_service.utils.circuit_breaker import CircuitBreakerOpenException
from ai_service.services.hf_client import (
    HF_TOKEN,
    HF_REASONING_MODEL,
    hf_chat_completion,
    extract_json,
)

load_dotenv()
logger = logging.getLogger("HFDiseaseService")


async def _call_hf_chat_json(system_prompt: str, user_prompt: str) -> Dict[str, Any]:
    """Raw Hugging Face chat-completion call returning parsed JSON. Raises on failure."""
    text = await hf_chat_completion(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        model=HF_REASONING_MODEL,
        temperature=0.2,
        max_tokens=1200,
        response_format={"type": "json_object"},
    )
    return extract_json(text)


async def analyze_disease_with_hf(
    symptoms: str,
    vision_findings: Optional[Dict[str, Any]] = None,
    rag_grounding: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Analyzes dermatological disease using an open-source Hugging Face model.
    """
    logger.info(f"Analyzing disease with Hugging Face ({HF_REASONING_MODEL}) (Symptoms len: {len(symptoms)})")

    if HF_TOKEN:
        try:
            system_prompt = (
                "You are an Expert Board-Certified Dermatologist. Output strictly valid JSON matching this schema:\n"
                "{\n"
                '  "condition": "string",\n'
                '  "icd_code": "string",\n'
                '  "confidence": number (0-100),\n'
                '  "severity": "Mild" | "Moderate" | "Severe" | "Critical",\n'
                '  "summary": "string",\n'
                '  "treatment_guidelines": ["string", "string"],\n'
                '  "citations": ["string"]\n'
                "}"
            )

            user_prompt = (
                f"Patient Symptoms: {symptoms}\n"
                f"Vision Findings: {json.dumps(vision_findings or {})}\n"
                f"Grounded Literature:\n{rag_grounding or 'Standard AAD Clinical Guidelines'}\n\n"
                "Generate clinical assessment JSON:"
            )

            parsed = await _call_hf_chat_json(system_prompt, user_prompt)
            return {
                "success": True,
                "provider": "Hugging Face",
                "model": HF_REASONING_MODEL,
                "data": parsed
            }
        except CircuitBreakerOpenException as e:
            logger.error(f"Hugging Face circuit breaker open: {e}")
            return {
                "success": False,
                "provider": "Hugging Face",
                "model": HF_REASONING_MODEL,
                "error": str(e),
                "data": None
            }
        except Exception as e:
            logger.error(f"Hugging Face API exception: {e}")
            # Honest failure — do NOT fabricate a diagnosis. Surface the error so
            # a broken/misconfigured model is caught and fixed on priority.
            return {
                "success": False,
                "provider": "Hugging Face",
                "model": HF_REASONING_MODEL,
                "error": str(e),
                "data": None
            }

    # No token configured — this is a real, reportable failure, not a diagnosis.
    return {
        "success": False,
        "provider": "Hugging Face",
        "model": HF_REASONING_MODEL,
        "error": "HF_TOKEN not configured",
        "data": None
    }
