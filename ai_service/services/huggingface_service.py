"""
Hugging Face Open-Source AI Service for FastAPI Microservice.
Provides:
1. Open-Source Dermatological Lesion Image Classification (HAM10000)
2. Open-Source BGE Vector Embeddings (BAAI/bge-small-en-v1.5)
3. Multi-Provider LLM Fallback (Mistral-7B / Llama-3.2)
"""

import os
import httpx
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

from ai_service.utils.url_safety import assert_public_http_url, UnsafeUrlError

load_dotenv()

HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY", "") or os.getenv("HF_TOKEN", "")

_HF_LESION_MODEL = "nateraw/skin-cancer-mnist-ham10000"


def _hf_failure(error: str) -> Dict[str, Any]:
    """Honest failure envelope — no fabricated prediction or confidence."""
    return {
        "success": False,
        "source": f"HuggingFace ({_HF_LESION_MODEL})",
        "model_used": _HF_LESION_MODEL,
        "error": error,
        "predictions": None,
        "top_prediction": None,
        "confidence_score": None,
    }


async def classify_skin_lesion_hf(
    image_url: Optional[str] = None,
    image_bytes: Optional[bytes] = None,
) -> Dict[str, Any]:
    """
    Classify a skin lesion photo using the Hugging Face HAM10000 vision model.

    Accepts either a public `image_url` (downloaded first) or raw `image_bytes`
    (e.g. decoded from a base64 data URI) posted directly to the inference API.

    Returns the REAL model prediction on success. On any failure (no key, no
    image, download/inference error) returns success=False with the error and NO
    fabricated prediction — a made-up "benign nevus" call on a broken model could
    cause a patient to ignore a real malignancy.
    """
    if not image_url and not image_bytes:
        return _hf_failure("No image provided for lesion classification")
    if not HF_API_KEY:
        return _hf_failure("HUGGINGFACE_API_KEY not configured")

    try:
        api_url = f"https://api-inference.huggingface.co/models/{_HF_LESION_MODEL}"
        headers = {"Authorization": f"Bearer {HF_API_KEY}"}

        async with httpx.AsyncClient() as client:
            content = image_bytes
            if content is None:
                # URL path — validate against SSRF, then download the image.
                try:
                    assert_public_http_url(image_url)
                except UnsafeUrlError as e:
                    return _hf_failure(f"Image URL rejected: {e}")
                img_resp = await client.get(image_url, timeout=10.0)
                if img_resp.status_code != 200:
                    return _hf_failure(f"Failed to download image (HTTP {img_resp.status_code})")
                content = img_resp.content

            hf_resp = await client.post(api_url, headers=headers, content=content, timeout=30.0)
            if hf_resp.status_code != 200:
                return _hf_failure(f"HuggingFace inference failed (HTTP {hf_resp.status_code}): {hf_resp.text[:200]}")

            predictions = hf_resp.json()

        # Derive the top prediction from the REAL model output, never a constant.
        if not isinstance(predictions, list) or not predictions:
            return _hf_failure(f"Unexpected model output: {str(predictions)[:200]}")

        top = max(predictions, key=lambda p: p.get("score", 0))
        return {
            "success": True,
            "source": f"HuggingFace ({_HF_LESION_MODEL})",
            "model_used": _HF_LESION_MODEL,
            "predictions": predictions,
            "top_prediction": top.get("label"),
            "confidence_score": round(float(top.get("score", 0)) * 100, 2),
        }
    except Exception as e:
        return _hf_failure(str(e))

async def generate_bge_embedding_hf(text: str) -> List[float]:
    """
    Generate a real vector embedding using BAAI/bge-small-en-v1.5.

    Raises on failure. A fake/pseudo-random embedding would silently poison every
    downstream vector search and cache lookup, producing meaningless "matches"
    that look real — so we never substitute one.
    """
    if not HF_API_KEY:
        raise RuntimeError("HUGGINGFACE_API_KEY not configured; cannot generate embedding")

    model_id = "BAAI/bge-small-en-v1.5"
    api_url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{model_id}"
    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    payload = {"inputs": text}

    async with httpx.AsyncClient() as client:
        resp = await client.post(api_url, headers=headers, json=payload, timeout=10.0)
        resp.raise_for_status()
        vec = resp.json()

    if not isinstance(vec, list) or len(vec) == 0:
        raise RuntimeError(f"Unexpected embedding output from {model_id}")

    raw_vec = vec[0] if isinstance(vec[0], list) else vec
    if len(raw_vec) < 768:
        return raw_vec + [0.0] * (768 - len(raw_vec))
    return raw_vec[:768]

async def generate_llm_completion_hf(prompt: str, max_new_tokens: int = 300) -> str:
    """
    Generate a real text completion via Mistral-7B on Hugging Face.

    Raises on failure — returning a canned "grounded clinical summary" string
    would masquerade as model-generated clinical content.
    """
    if not HF_API_KEY:
        raise RuntimeError("HUGGINGFACE_API_KEY not configured; cannot generate completion")

    model_id = "mistralai/Mistral-7B-Instruct-v0.3"
    api_url = f"https://api-inference.huggingface.co/models/{model_id}"
    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    # Mistral-Instruct is tuned on the [INST] chat template; wrap the prompt so
    # we get an answer, not a continuation. return_full_text=False strips the
    # echoed prompt from the response.
    payload = {
        "inputs": f"<s>[INST] {prompt} [/INST]",
        "parameters": {
            "max_new_tokens": max_new_tokens,
            "temperature": 0.2,
            "return_full_text": False,
        },
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(api_url, headers=headers, json=payload, timeout=30.0)
        resp.raise_for_status()
        data = resp.json()

    if isinstance(data, list) and len(data) > 0 and "generated_text" in data[0]:
        return data[0]["generated_text"].strip()
    raise RuntimeError(f"Unexpected completion output from {model_id}")
