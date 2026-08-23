"""
LLM-as-a-Judge Evaluation & Benchmarking Harness (Python).

Runs the benchmark cases against the REAL multi-agent pipeline (Gemini/OpenAI)
and reports true metrics. Critically, this harness is honest about model health:

  * A case counts as PASSED only if the model actually ran AND the predicted
    condition matches the expected one.
  * If the model was unavailable for a case, that case is FAILED, its evaluated
    condition is "MODEL UNAVAILABLE", and the per-case model status/error is
    recorded — so a broken model shows up as low accuracy plus explicit errors,
    never as a fake pass.

The aggregate report includes a `model_engine` block summarizing how many cases
the model successfully executed vs. failed, giving an at-a-glance model-health
signal alongside the accuracy number.
"""

import os
import json
import time
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List

from ai_service.services.orchestrator_service import run_multi_agent_pipeline

# Benchmark dataset is shared with the TS side to avoid drift.
_BENCHMARKS_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "src", "ai", "eval", "datasets", "dermatology-benchmarks.json",
)


def _load_benchmarks() -> List[Dict[str, Any]]:
    with open(_BENCHMARKS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _condition_matches(evaluated: str, expected: str) -> bool:
    e = (evaluated or "").lower()
    x = (expected or "").lower()
    if not e or not x:
        return False
    return x in e or e in x


async def _evaluate_case(case: Dict[str, Any], provider: str) -> Dict[str, Any]:
    start = time.time()
    result = await run_multi_agent_pipeline(case["inputSymptoms"], provider=provider)
    execution_ms = round((time.time() - start) * 1000, 2)

    model_meta = result.get("model_metadata") or {}
    model_ran = bool(result.get("success"))

    if not model_ran:
        # Honest failure — no diagnosis to score.
        return {
            "caseId": case["id"],
            "caseTitle": case["caseTitle"],
            "passed": False,
            "expectedCondition": case["expectedCondition"],
            "evaluatedCondition": "MODEL UNAVAILABLE",
            "executionTimeMs": execution_ms,
            "modelUsed": model_meta.get("model"),
            "modelProvider": model_meta.get("provider"),
            "modelStatus": "failed",
            "error": result.get("error"),
            "hasCitations": False,
            "hasDisclaimer": False,
        }

    report = result.get("report") or {}
    evaluated = report.get("primary_condition_name", "")
    passed = _condition_matches(evaluated, case["expectedCondition"])

    return {
        "caseId": case["id"],
        "caseTitle": case["caseTitle"],
        "passed": passed,
        "expectedCondition": case["expectedCondition"],
        "evaluatedCondition": evaluated,
        "executionTimeMs": execution_ms,
        "modelUsed": model_meta.get("model"),
        "modelProvider": model_meta.get("provider"),
        "modelStatus": "ok",
        "error": None,
        "hasCitations": len(report.get("citations_used", [])) > 0,
        "hasDisclaimer": bool(report.get("disclaimer")),
    }


async def run_eval_harness(provider: str = "gemini") -> Dict[str, Any]:
    """Run all benchmark cases concurrently against the real model engine."""
    benchmarks = _load_benchmarks()

    results = await asyncio.gather(
        *[_evaluate_case(case, provider) for case in benchmarks]
    )

    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    model_ok = sum(1 for r in results if r["modelStatus"] == "ok")
    model_failed = total - model_ok
    citations = sum(1 for r in results if r["hasCitations"])
    disclaimers = sum(1 for r in results if r["hasDisclaimer"])
    total_latency = sum(r["executionTimeMs"] for r in results)

    # Model-health aware: pick the provider/model that actually served cases.
    served = next((r for r in results if r["modelStatus"] == "ok"), None)

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "totalCases": total,
        "passedCases": passed,
        "accuracyPercentage": round(passed / total * 100) if total else 0,
        "citationCoveragePercentage": round(citations / total * 100) if total else 0,
        "disclaimerCompliancePercentage": round(disclaimers / total * 100) if total else 0,
        "avgLatencyMs": round(total_latency / total) if total else 0,
        "modelEngine": {
            "provider": served["modelProvider"] if served else None,
            "model": served["modelUsed"] if served else None,
            "available": model_ok > 0,
            "casesModelSucceeded": model_ok,
            "casesModelFailed": model_failed,
        },
        "results": results,
    }
