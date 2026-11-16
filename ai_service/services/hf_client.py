"""
Central Hugging Face Inference client for the DermiAssist-AI engine.

This is the single source of truth for every LLM/vision/text call in the Python
engine. All feature services (differential diagnosis, structured JSON analysis,
the LangGraph vision/proforma/evaluation agents and the eval judge) route their
inference through the helpers here so the project depends on ONE open-source
provider — Hugging Face Inference Providers via ``huggingface_hub`` — keyed by a
single ``HF_TOKEN`` user access token.
Explicit ``INFERENCE_PROVIDER=groq`` instead uses Groq directly with
``GROQ_API_KEY``; provider failures never trigger a switch to paid HF inference.

Design contract (inherited from the project's no-fake-fallbacks rule):
  * Every helper RAISES on failure (missing token, rate limit, bad output). No
    helper ever fabricates a prediction/answer — callers must surface the
    failure, never mask it with canned clinical text.
  * ``huggingface_hub.InferenceClient`` is synchronous; every call is offloaded
    to a worker thread so it never blocks the FastAPI event loop, and is wrapped
    in the shared HuggingFace circuit breaker.
"""

import os
import json
import asyncio
import logging
import httpx
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

from ai_service.utils.circuit_breaker import (
    huggingface_circuit_breaker,
    groq_circuit_breaker,
    with_circuit_breaker,
)

load_dotenv()
logger = logging.getLogger("HFClient")

# Single Hugging Face access token for every inference call. HUGGINGFACE_API_KEY
# is still accepted for backward compatibility with the existing deployments.
HF_TOKEN = os.getenv("HF_TOKEN", "") or os.getenv("HUGGINGFACE_API_KEY", "")
INFERENCE_PROVIDER = os.getenv("INFERENCE_PROVIDER", "") or "huggingface"
if INFERENCE_PROVIDER not in ("huggingface", "groq"):
    raise ValueError("INFERENCE_PROVIDER must be huggingface or groq")
PROVIDER_NAME = "Groq" if INFERENCE_PROVIDER == "groq" else "Hugging Face"
TOKEN_ENV = "GROQ_API_KEY" if INFERENCE_PROVIDER == "groq" else "HF_TOKEN"
INFERENCE_TOKEN = os.getenv("GROQ_API_KEY", "") if INFERENCE_PROVIDER == "groq" else HF_TOKEN
GROQ_MODEL = os.getenv("GROQ_MODEL", "") or "qwen/qwen3.8-27b"
inference_circuit_breaker = groq_circuit_breaker if INFERENCE_PROVIDER == "groq" else huggingface_circuit_breaker

# ── Open-source model matrix ─────────────────────────────────────────────────
# Overridable via env so a deployment can pin a different open checkpoint without
# a code change.
#   * Chatbot / general text      -> small, fast instruct model.
#   * Structured JSON / reasoning / reports -> stronger instruct model.
#   * Vision / multimodal reasoning -> an open vision-language instruct model.
HF_CHAT_MODEL = os.getenv("HF_CHAT_MODEL", "meta-llama/Llama-3.2-3B-Instruct")
HF_REASONING_MODEL = os.getenv("HF_REASONING_MODEL", "Qwen/Qwen2.5-7B-Instruct")
HF_REASONING_FALLBACK_MODEL = os.getenv(
    "HF_REASONING_FALLBACK_MODEL", "meta-llama/Meta-Llama-3-8B-Instruct"
)
HF_VISION_MODEL = os.getenv("HF_VISION_MODEL", "Qwen/Qwen2.5-VL-3B-Instruct")
if INFERENCE_PROVIDER == "groq":
    HF_CHAT_MODEL = HF_REASONING_MODEL = HF_REASONING_FALLBACK_MODEL = HF_VISION_MODEL = GROQ_MODEL


class HFTokenMissingError(RuntimeError):
    """Raised when the selected provider's token is missing."""


def hf_token_configured() -> bool:
    """Legacy helper name; checks only the explicitly selected provider."""
    return bool(INFERENCE_TOKEN)


def get_hf_client():
    """Return a configured ``InferenceClient`` or raise if the token is missing.

    ``huggingface_hub`` is imported lazily so merely importing this module (e.g.
    during tests) does not require the package to be installed.
    """
    if not HF_TOKEN:
        raise HFTokenMissingError(
            "HF_TOKEN not configured; set a Hugging Face user access token to "
            "enable model inference."
        )
    from huggingface_hub import InferenceClient

    return InferenceClient(api_key=HF_TOKEN)


def _content_text(message: Any) -> str:
    """Extract text content from a chat-completion message across HF versions."""
    content = getattr(message, "content", None)
    if content is None and isinstance(message, dict):
        content = message.get("content")
    if isinstance(content, list):
        # Some providers return content as a list of parts.
        return "".join(
            part.get("text", "") if isinstance(part, dict) else str(part)
            for part in content
        )
    return content or ""


async def hf_chat_completion(
    messages: List[Dict[str, Any]],
    model: Optional[str] = None,
    max_tokens: int = 1000,
    temperature: float = 0.2,
    response_format: Optional[Dict[str, Any]] = None,
) -> str:
    """Run an open-source chat completion and return the raw assistant text.

    Raises on missing token, circuit-open, rate limit, or any provider error.
    """
    if not INFERENCE_TOKEN:
        raise HFTokenMissingError(f"{TOKEN_ENV} not configured; cannot run {PROVIDER_NAME} inference")
    model_id = model or HF_CHAT_MODEL

    async def _call_groq() -> str:
        kwargs: Dict[str, Any] = {
            "model": model_id,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "reasoning_effort": "none",
        }
        if response_format is not None:
            kwargs["response_format"] = response_format
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {INFERENCE_TOKEN}"},
                json=kwargs,
            )
            if not response.is_success:
                raise RuntimeError(
                    f"Groq inference failed (HTTP {response.status_code}): {response.text[:300]}"
                )
            data = response.json()
            choices = data.get("choices")
            if not isinstance(choices, list) or not choices:
                raise RuntimeError(f"Missing completion from Groq model {model_id}")
            return _content_text(choices[0].get("message", {}))

    def _call() -> str:
        kwargs: Dict[str, Any] = {
            "model": model_id,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if response_format is not None:
            kwargs["response_format"] = response_format
        completion = get_hf_client().chat_completion(**kwargs)
        return _content_text(completion.choices[0].message)

    if INFERENCE_PROVIDER == "groq":
        text = await with_circuit_breaker(inference_circuit_breaker, _call_groq)
    else:
        text = await with_circuit_breaker(inference_circuit_breaker, asyncio.to_thread, _call)
    if not isinstance(text, str) or not text.strip():
        raise RuntimeError(f"Empty completion from {PROVIDER_NAME} model {model_id}")
    return text


def extract_json(text: str) -> Dict[str, Any]:
    """Parse a JSON object from a model response, tolerating markdown fences."""
    cleaned = (text or "").strip()
    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in cleaned:
        cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()
    return json.loads(cleaned)


async def hf_chat_json(
    system_prompt: str,
    user_prompt: str,
    model: Optional[str] = None,
    max_tokens: int = 1200,
    temperature: float = 0.2,
) -> Dict[str, Any]:
    """Chat completion that returns a parsed JSON object (open-source model).

    Requests JSON via ``response_format`` where the provider supports it and
    always re-parses defensively. Raises on any failure or unparseable output.
    """
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    text = await hf_chat_completion(
        messages,
        model=model or HF_REASONING_MODEL,
        max_tokens=max_tokens,
        temperature=temperature,
        response_format={"type": "json_object"},
    )
    return extract_json(text)


async def hf_vision_chat(
    prompt: str,
    image_url: str,
    model: Optional[str] = None,
    max_tokens: int = 300,
    temperature: float = 0.2,
) -> str:
    """Multimodal chat completion over an image URL/data-URI (open-source model)."""
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": image_url}},
            ],
        }
    ]
    return await hf_chat_completion(
        messages,
        model=model or HF_VISION_MODEL,
        max_tokens=max_tokens,
        temperature=temperature,
    )
