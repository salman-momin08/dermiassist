---
name: no-fake-fallbacks
description: User rejects hardcoded/heuristic fallbacks that mask failing models; wants honest failure surfacing
metadata:
  type: feedback
---

For the DermiAssist-AI project, the user does NOT want hardcoded or keyword-heuristic fallbacks that substitute for a failing AI model. When a model call fails (no key, quota, timeout), the system must return an honest failure (success=false, model name, error, latency) and NO fabricated diagnosis — never confident-looking fake output.

**Why:** This is a clinical decision-support tool. A fake fallback that mimics real model output hides broken models, so failures go unnoticed and un-prioritized. Silent fallbacks are "a backfire." The user also wants exact info on which model actually ran.

**How to apply:** Prefer real dynamic inference (Gemini 2.5 Flash → OpenAI GPT-4o) in the Python engine ([ai_service/services/llm_diagnosis.py](../ai_service/services/llm_diagnosis.py)). Surface per-request model metadata (provider, model, attempts). In evals, a case only passes if the model actually ran AND matched; model-down cases show as FAILED with "MODEL UNAVAILABLE", not fake passes. Removed: keyword symptom-classifier, fabricated "Atopic Dermatitis" fallbacks in openai_service.py and the deleted src/ai/providers/openai-service.ts.
