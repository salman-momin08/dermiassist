"""
Drug Interaction Service.

Checks a topical + oral (or two oral) medication combination for interactions
using two real layers:

  1. A curated set of well-established, high-severity dermatology-relevant
     contraindications (e.g. oral isotretinoin + tetracyclines).
  2. Live data from the openFDA drug label API (https://api.fda.gov) — we read
     the `drug_interactions` / `warnings` sections of each drug's FDA label and
     check whether the other drug (by name) is referenced.

Safety rules:
  * A curated contraindication is authoritative -> safe_to_combine = False.
  * An openFDA label that references the other drug -> flag a POTENTIAL
    interaction with the label excerpt and source (safe_to_combine = False).
  * Otherwise -> safe_to_combine = None ("not assessed"). Absence of a match in
    openFDA is NOT proof of safety, so we NEVER return True for an uncharacterized
    pair. We only return True for the specific, well-known compatible pairs we
    curate explicitly.
"""

import logging
from typing import Dict, Any, Optional, List

import httpx

logger = logging.getLogger("DrugInteractionService")

OPENFDA_LABEL_URL = "https://api.fda.gov/drug/label.json"

# Curated, well-established rules. Each entry is (predicate, result).
# These are authoritative and do not depend on the network.
_CURATED_CONTRAINDICATIONS = [
    {
        "match": lambda a, b: ("isotretinoin" in a or "isotretinoin" in b)
        and any(t in a or t in b for t in ["tetracycline", "doxycycline", "minocycline"]),
        "result": {
            "safe_to_combine": False,
            "interaction_risk_level": "severe",
            "warning_message": (
                "CRITICAL CONTRAINDICATION: Oral isotretinoin combined with tetracyclines "
                "(doxycycline/minocycline/tetracycline) carries a risk of idiopathic "
                "intracranial hypertension (pseudotumor cerebri). Do NOT combine."
            ),
            "recommended_spacing_hours": None,
            "source": "Established dermatology contraindication (FDA isotretinoin labeling / iPLEDGE)",
        },
    },
    {
        "match": lambda a, b: ("benzoyl" in a and "tretinoin" in b) or ("tretinoin" in a and "benzoyl" in b)
        or ("benzoyl" in a and "tretinoin" in a) or ("benzoyl" in b and "tretinoin" in b),
        "result": {
            "safe_to_combine": True,
            "interaction_risk_level": "moderate",
            "warning_message": (
                "Benzoyl peroxide can oxidize and inactivate tretinoin when applied together. "
                "Apply benzoyl peroxide in the morning and tretinoin at night (or use a stabilized formulation)."
            ),
            "recommended_spacing_hours": 12,
            "source": "Established dermatology compatibility guidance",
        },
    },
]


def _normalize(name: Optional[str]) -> str:
    return (name or "").strip().lower()


def _check_curated(a: str, b: str) -> Optional[Dict[str, Any]]:
    for rule in _CURATED_CONTRAINDICATIONS:
        try:
            if rule["match"](a, b):
                return dict(rule["result"])
        except Exception:
            continue
    return None


async def _query_openfda(client: httpx.AsyncClient, drug: str, other: str) -> Optional[Dict[str, Any]]:
    """Fetch `drug`'s FDA label and check if `other` appears in its interaction text.

    Returns a finding dict if a reference is found, None if not found, and raises
    on network/parse error so the caller can report an honest 'not assessed'.
    """
    if not drug:
        return None
    params = {
        "search": f'openfda.generic_name:"{drug}" OR openfda.brand_name:"{drug}"',
        "limit": 1,
    }
    resp = await client.get(OPENFDA_LABEL_URL, params=params, timeout=10.0)
    if resp.status_code == 404:
        # openFDA returns 404 when no label matches the search — no data, not an error.
        return None
    resp.raise_for_status()
    results = resp.json().get("results", [])
    if not results:
        return None

    label = results[0]
    sections: List[str] = []
    for key in ("drug_interactions", "warnings", "contraindications", "warnings_and_cautions"):
        val = label.get(key)
        if isinstance(val, list):
            sections.extend(val)
    haystack = "\n".join(sections).lower()

    if other and other in haystack:
        # Extract a short excerpt around the mention for transparency.
        idx = haystack.find(other)
        excerpt = haystack[max(0, idx - 120): idx + 160].strip()
        return {
            "found": True,
            "excerpt": excerpt,
            "source": "openFDA drug label (api.fda.gov)",
        }
    return {"found": False, "source": "openFDA drug label (api.fda.gov)"}


async def check_drug_interaction(
    topical_medication: str,
    oral_medication: Optional[str] = None,
) -> Dict[str, Any]:
    a = _normalize(topical_medication)
    b = _normalize(oral_medication)

    if not a and not b:
        return {
            "safe_to_combine": None,
            "interaction_risk_level": "unknown",
            "warning_message": "No medications provided to assess.",
            "recommended_spacing_hours": None,
            "sources": [],
        }

    # Layer 1: authoritative curated rules.
    curated = _check_curated(a, b)
    if curated:
        return {
            "safe_to_combine": curated["safe_to_combine"],
            "interaction_risk_level": curated["interaction_risk_level"],
            "warning_message": curated["warning_message"],
            "recommended_spacing_hours": curated.get("recommended_spacing_hours"),
            "sources": [curated["source"]],
        }

    # Layer 2: live openFDA label lookup (both directions).
    if a and b:
        try:
            async with httpx.AsyncClient() as client:
                f1 = await _query_openfda(client, a, b)
                f2 = await _query_openfda(client, b, a)

            findings = [f for f in (f1, f2) if f and f.get("found")]
            if findings:
                excerpts = "; ".join(f"…{f['excerpt']}…" for f in findings if f.get("excerpt"))
                return {
                    "safe_to_combine": False,
                    "interaction_risk_level": "potential",
                    "warning_message": (
                        "A potential interaction was found in the FDA drug labeling for this "
                        f"combination. Review with a pharmacist/clinician. Label excerpt: {excerpts}"
                    ),
                    "recommended_spacing_hours": None,
                    "sources": ["openFDA drug label (api.fda.gov)"],
                }

            # Labels were retrieved but neither references the other drug. This is
            # absence of evidence, NOT proof of safety.
            if f1 is not None or f2 is not None:
                return {
                    "safe_to_combine": None,
                    "interaction_risk_level": "unknown",
                    "warning_message": (
                        "No interaction was found between these medications in the FDA labeling "
                        "we checked, but absence of a documented interaction does not guarantee "
                        "safety. Confirm with a pharmacist or the prescribing clinician."
                    ),
                    "recommended_spacing_hours": None,
                    "sources": ["openFDA drug label (api.fda.gov)"],
                }
        except Exception as e:
            logger.error(f"openFDA lookup failed: {e}")
            # Fall through to honest "not assessed".

    # Nothing authoritative and no live data — do not guess safety.
    return {
        "safe_to_combine": None,
        "interaction_risk_level": "unknown",
        "warning_message": (
            "This medication combination could not be assessed (not covered by built-in rules "
            "and no drug-label data was available). Do not assume it is safe — consult a "
            "pharmacist or the prescribing clinician."
        ),
        "recommended_spacing_hours": None,
        "sources": [],
    }
