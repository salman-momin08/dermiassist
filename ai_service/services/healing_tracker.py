"""
Longitudinal Lesion Healing Tracker Service.

Runs the HAM10000 classifier on the baseline and follow-up photos and reports the
REAL per-image classification for each.

IMPORTANT: quantitative healing metrics (surface-area reduction %, erythema
fading index, healing velocity) require pixel-level image segmentation that is
NOT implemented. The previous version fabricated these from `days_elapsed` alone,
with no relationship to the actual images — dangerous in a medical app. Until a
real segmentation pipeline exists, we report only what the model genuinely
produces and explicitly flag quantitative metrics as unavailable.
"""

from typing import Dict, Any

from ai_service.services.huggingface_service import classify_skin_lesion_hf


def _assessment(analysis: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "success": bool(analysis.get("success")),
        "top_prediction": analysis.get("top_prediction"),
        "confidence": analysis.get("confidence_score"),
        "model_used": analysis.get("model_used"),
        "error": analysis.get("error"),
    }


async def track_longitudinal_healing(
    initial_image_url: str,
    current_image_url: str,
    days_elapsed: int = 14
) -> Dict[str, Any]:
    """Classify baseline vs follow-up images. No fabricated healing metrics."""
    initial_analysis = await classify_skin_lesion_hf(initial_image_url)
    current_analysis = await classify_skin_lesion_hf(current_image_url)

    baseline = _assessment(initial_analysis)
    followup = _assessment(current_analysis)

    both_ok = baseline["success"] and followup["success"]

    classification_changed = None
    if both_ok:
        classification_changed = baseline["top_prediction"] != followup["top_prediction"]

    if both_ok:
        note = (
            "Per-image classification from the HAM10000 model is provided. "
            "Quantitative healing metrics (surface-area reduction, erythema fading) "
            "require image segmentation, which is not yet implemented, so they are "
            "not reported. Classification labels are not a substitute for a "
            "clinician's assessment of healing."
        )
        error = None
    else:
        note = "One or both images could not be classified; see per-image errors."
        error = "; ".join(
            e for e in [
                None if baseline["success"] else f"baseline: {baseline['error']}",
                None if followup["success"] else f"followup: {followup['error']}",
            ] if e
        )

    return {
        "success": both_ok,
        "days_elapsed": days_elapsed,
        "baseline_assessment": baseline,
        "followup_assessment": followup,
        "quantitative_metrics_available": False,
        "classification_changed": classification_changed,
        "note": note,
        "error": error,
    }
