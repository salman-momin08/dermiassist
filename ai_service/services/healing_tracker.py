"""
Longitudinal Lesion Healing Tracker Service.

Two REAL signals from the two actual photos:
  1. HAM10000 classification of each image (via the honest HF classifier).
  2. Image-derived pixel measurements computed directly from the images — an
     erythema (redness) index and a reddened-area fraction, compared between
     baseline and follow-up.

These pixel measurements are genuine measurements of the uploaded images, but
they are NOT clinically validated healing metrics (lighting, angle, zoom, and
skin tone all affect them). They are surfaced with `validated: false` and a clear
note. The previous version fabricated "surface area reduction %" from
`days_elapsed` alone with no relationship to the images — that has been removed.

Pillow/numpy are imported lazily so the rest of the service works even if they
are not installed; if they are unavailable or an image cannot be fetched, the
measurement is omitted honestly rather than faked.
"""

from typing import Dict, Any, Optional, Tuple

import httpx

from ai_service.services.huggingface_service import classify_skin_lesion_hf
from ai_service.utils.url_safety import assert_public_http_url


def _assessment(analysis: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "success": bool(analysis.get("success")),
        "top_prediction": analysis.get("top_prediction"),
        "confidence": analysis.get("confidence_score"),
        "model_used": analysis.get("model_used"),
        "error": analysis.get("error"),
    }


async def _measure_image(url: str) -> Optional[Tuple[float, float]]:
    """Return (lesion_area_fraction, mean_erythema) for an image URL, or None.

    Erythema per pixel is defined as normalized redness R - (G+B)/2 in [0,1]. A
    pixel is counted as "reddened" (lesion proxy) when its erythema exceeds a
    fixed threshold. Both are REAL measurements of the image pixels.
    """
    try:
        assert_public_http_url(url)

        import numpy as np  # lazy import
        from PIL import Image  # lazy import
        import io

        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10.0)
            resp.raise_for_status()
            content = resp.content

        img = Image.open(io.BytesIO(content)).convert("RGB").resize((256, 256))
        arr = np.asarray(img, dtype=np.float32) / 255.0
        r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
        erythema = np.clip(r - (g + b) / 2.0, 0.0, 1.0)

        threshold = 0.12
        reddened = erythema > threshold
        area_fraction = float(reddened.mean())
        mean_erythema = float(erythema[reddened].mean()) if reddened.any() else 0.0
        return area_fraction, mean_erythema
    except Exception:
        return None


def _pct_change(baseline: float, follow: float) -> float:
    if baseline <= 1e-6:
        return 0.0
    return round((follow - baseline) / baseline * 100.0, 1)


async def track_longitudinal_healing(
    initial_image_url: str,
    current_image_url: str,
    days_elapsed: int = 14
) -> Dict[str, Any]:
    """Classify both images and compute real image-derived measurements."""
    initial_analysis = await classify_skin_lesion_hf(initial_image_url)
    current_analysis = await classify_skin_lesion_hf(current_image_url)

    baseline = _assessment(initial_analysis)
    followup = _assessment(current_analysis)
    both_classified = baseline["success"] and followup["success"]

    classification_changed = None
    if both_classified:
        classification_changed = baseline["top_prediction"] != followup["top_prediction"]

    # Real pixel measurements from the actual images (independent of the classifier).
    m0 = await _measure_image(initial_image_url)
    m1 = await _measure_image(current_image_url)

    image_measurements = None
    if m0 is not None and m1 is not None:
        base_area, base_ery = m0
        foll_area, foll_ery = m1
        image_measurements = {
            "baseline_lesion_area_fraction": round(base_area, 4),
            "followup_lesion_area_fraction": round(foll_area, 4),
            "area_change_percent": _pct_change(base_area, foll_area),
            "baseline_mean_erythema": round(base_ery, 4),
            "followup_mean_erythema": round(foll_ery, 4),
            "erythema_change_percent": _pct_change(base_ery, foll_ery),
            "method": (
                "Pixel-level redness R-(G+B)/2 on 256x256 RGB; reddened-area fraction at "
                "threshold 0.12. Affected by lighting/angle/zoom/skin tone."
            ),
            "validated": False,
        }

    success = both_classified or image_measurements is not None

    if image_measurements is not None:
        note = (
            "Image-derived erythema and reddened-area measurements are provided from the "
            "two photos. These are NOT clinically validated healing metrics — lighting, "
            "camera angle, zoom, and skin tone strongly affect them, so interpret trends "
            "cautiously and confirm healing with a clinician."
        )
    elif both_classified:
        note = (
            "Per-image classification is provided. Image-derived measurements could not be "
            "computed (image processing unavailable or images unreadable)."
        )
    else:
        note = "Neither image could be classified or measured; see per-image errors."

    error = None
    if not success:
        error = "; ".join(
            e for e in [
                None if baseline["success"] else f"baseline: {baseline['error']}",
                None if followup["success"] else f"followup: {followup['error']}",
            ] if e
        ) or "Image classification and measurement both failed."

    return {
        "success": success,
        "days_elapsed": days_elapsed,
        "baseline_assessment": baseline,
        "followup_assessment": followup,
        "image_measurements": image_measurements,
        "quantitative_metrics_available": image_measurements is not None,
        "classification_changed": classification_changed,
        "note": note,
        "error": error,
    }
