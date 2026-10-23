import os
import json
import re
import asyncio
import importlib
from typing import TypedDict, List, Dict, Any, Optional
from dotenv import load_dotenv

from langgraph.graph import StateGraph, END

from ai_service.services.huggingface_service import (
    generate_llm_completion_hf,
    classify_skin_lesion_bytes_hf,
)

load_dotenv()

# Setup API Keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_GENAI_API_KEY") or os.getenv("GOOGLE_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

def _get_genai_module():
    """Safely import google.generativeai if installed."""
    try:
        return importlib.import_module("google.generativeai")
    except ImportError:
        return None

# State Definition — shared across all three compiled graphs below. Every node
# reads/writes a subset of these keys; LangGraph merges a node's returned dict
# into the running state (partial updates), so nodes only need to return the
# keys they actually touch.
class DermatologyState(TypedDict, total=False):
    # Inputs, populated by the execute_langgraph_* callers before invoking a graph.
    photo_data_uri: Optional[str]
    condition_name: Optional[str]
    conversation_history: Optional[str]
    user_answers: Optional[str]
    turn_count: int

    # Outputs, written by whichever node in the chain succeeds.
    current_question: Optional[str]
    final_evaluation: Optional[Dict[str, Any]]
    confidence_score: Optional[float]
    error: Optional[str]

    # Graph control-flow bookkeeping (internal to this module — not part of any
    # public API response). `success` drives the conditional edges below;
    # `attempts` accumulates "Provider: error message" strings across tiers so
    # the terminal node's raised error mirrors the original code's combined
    # "failed on all providers. Gemini: ...; OpenAI: ..." message.
    success: bool
    attempts: List[str]

def _get_gemini_model(model_name: str = "gemini-2.5-flash"):
    """Initialize Google Gemini client safely."""
    genai = _get_genai_module()
    if not genai:
        return None
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
    return genai.GenerativeModel(model_name)

def _get_openai_client():
    """Initialize OpenAI client if available."""
    if not OPENAI_API_KEY:
        return None
    try:
        from openai import AsyncOpenAI
        return AsyncOpenAI(api_key=OPENAI_API_KEY)
    except Exception:
        return None

# Quota / limit-exhaustion markers. On the free tier these won't recover within
# our short retry window, so retrying with backoff just wastes seconds — we fall
# straight through to the next provider (OpenAI, then HuggingFace) instead.
_QUOTA_MARKERS = (
    "429", "rate limit", "resource_exhausted", "quota", "exhausted",
    "insufficient_quota", "billing",
)

# Genuinely transient markers (server overloaded / network blip) worth a brief
# retry before falling through to the next provider.
_TRANSIENT_MARKERS = (
    "503", "unavailable", "high demand", "overloaded", "try again later",
    "timeout", "deadline",
)

def _is_quota_error(err: Exception) -> bool:
    msg = str(err).lower()
    return any(marker in msg for marker in _QUOTA_MARKERS)

def _is_transient_error(err: Exception) -> bool:
    msg = str(err).lower()
    return any(marker in msg for marker in _TRANSIENT_MARKERS)

async def _gemini_generate_with_retry(model, contents, max_retries: int = 3, base_delay: float = 1.0):
    """Call Gemini's blocking generate_content off the event loop, retrying with
    exponential backoff on transient errors (e.g. 503 "high demand", 429).

    Permanent errors (bad model id, auth, invalid request) are re-raised
    immediately so the caller can fall back to another provider without waiting.
    """
    last_err: Optional[Exception] = None
    for attempt in range(max_retries):
        try:
            return await asyncio.to_thread(model.generate_content, contents)
        except Exception as e:  # noqa: BLE001 — classify by message, then re-raise
            last_err = e
            # Quota exhaustion or a permanent error: don't burn the retry window —
            # raise now so the caller falls through to OpenAI/HuggingFace fast.
            if _is_quota_error(e) or not _is_transient_error(e) or attempt == max_retries - 1:
                raise
            delay = base_delay * (2 ** attempt)
            print(f"[Gemini transient error — retry {attempt + 1}/{max_retries} in {delay}s]: {e}")
            await asyncio.sleep(delay)
    # Loop always returns or raises; this satisfies type-checkers.
    raise last_err  # type: ignore[misc]

# =====================================================================
# Graph 1: Vision Diagnostic Condition Detection
#   try_gemini --(success)--> END
#   try_gemini --(failure)--> try_openai --(success)--> END
#   try_openai --(failure)--> try_hf --(success)--> END
#   try_hf     --(failure)--> raises (terminal, no fabricated condition)
#
# The HuggingFace tier (HAM10000 lesion classifier) is a genuine last-resort
# fallback for when both Gemini and OpenAI are unavailable (e.g. the free-tier
# quota is exhausted during testing). Its 7-class lesion taxonomy differs from
# the open-vocabulary names Gemini/OpenAI return, so the label is mapped to a
# readable condition name — it is still a REAL model prediction, never a guess.
# =====================================================================

# HAM10000 raw class labels → human-readable dermatological condition names.
_HAM10000_LABEL_MAP = {
    "benign_keratosis-like_lesions": "Benign Keratosis",
    "basal_cell_carcinoma": "Basal Cell Carcinoma",
    "actinic_keratoses": "Actinic Keratosis",
    "vascular_lesions": "Vascular Lesion",
    "melanocytic_Nevi": "Melanocytic Nevus",
    "melanoma": "Melanoma",
    "dermatofibroma": "Dermatofibroma",
}

def _humanize_ham10000_label(label: Optional[str]) -> str:
    if not label:
        return "Dermatological Condition"
    return _HAM10000_LABEL_MAP.get(label, label.replace("_", " ").strip().title())

_DETECT_PROMPT = """You are an expert dermatologist AI. Analyze the provided image of a skin condition.
Your ONLY task is to identify the most likely skin condition and return its common medical name (e.g. Psoriasis, Eczema, Acne Vulgaris, Rosacea, Seborrheic Dermatitis, Contact Dermatitis, Melanocytic Nevus).
Do not provide any other information, summary, or recommendations. Return ONLY the condition name."""

def _parse_photo_data_uri(photo_uri: str) -> tuple:
    mime_type = "image/jpeg"
    base64_data = photo_uri
    if "," in photo_uri:
        header, base64_data = photo_uri.split(",", 1)
        if "image/png" in header:
            mime_type = "image/png"
        elif "image/webp" in header:
            mime_type = "image/webp"
    return mime_type, base64_data

async def _detect_try_gemini(state: DermatologyState) -> Dict[str, Any]:
    """Node 1a: Gemini multimodal vision call — the primary condition detector."""
    photo_uri = state.get("photo_data_uri")
    if not photo_uri:
        raise ValueError("No image provided for condition detection")

    try:
        mime_type, base64_data = _parse_photo_data_uri(photo_uri)
        model = _get_gemini_model("gemini-2.5-flash")
        if not model:
            raise RuntimeError("Gemini model not initialized")

        image_part = {"mime_type": mime_type, "data": base64_data}
        # generate_content is a blocking sync call — offload to a thread (so it
        # doesn't block the FastAPI event loop) and retry transient overloads.
        response = await _gemini_generate_with_retry(model, [_DETECT_PROMPT, image_part])
        condition_name = response.text.strip().replace("*", "").replace("\n", " ")
        condition_name = re.sub(r'^["\']|["\']$', '', condition_name).strip()

        return {"condition_name": condition_name or "Dermatological Condition", "turn_count": 0, "success": True}
    except Exception as e:
        print(f"[LangGraph Vision Node Error — Gemini]: {e}")
        return {"success": False, "attempts": state.get("attempts", []) + [f"Gemini: {e}"]}

async def _detect_try_openai(state: DermatologyState) -> Dict[str, Any]:
    """Node 1b: OpenAI GPT-4o vision fallback — a genuine second model, not a canned answer.

    Non-terminal: on failure it returns success=False so the graph falls through
    to the HuggingFace lesion classifier instead of dead-ending here.
    """
    photo_uri = state.get("photo_data_uri")
    attempts = state.get("attempts", [])
    openai_client = _get_openai_client()
    if not openai_client:
        return {"success": False, "attempts": attempts + ["OpenAI: OPENAI_API_KEY not configured"]}
    try:
        res = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": _DETECT_PROMPT},
                        {"type": "image_url", "image_url": {"url": photo_uri}}
                    ]
                }
            ],
            max_tokens=50
        )
        detected = (res.choices[0].message.content or "").strip()
        if detected:
            return {"condition_name": detected, "turn_count": 0, "success": True}
        return {"success": False, "attempts": attempts + ["OpenAI: returned empty condition"]}
    except Exception as oai_err:
        print(f"[LangGraph OpenAI Vision Fallback Error]: {oai_err}")
        return {"success": False, "attempts": attempts + [f"OpenAI: {oai_err}"]}

async def _detect_try_hf(state: DermatologyState) -> Dict[str, Any]:
    """Node 1c: HuggingFace HAM10000 lesion classifier — real open-source
    last-resort vision fallback when both Gemini and OpenAI are unavailable
    (e.g. free-tier quota exhausted during testing). Terminal node: raises on
    failure so no fabricated condition is ever returned."""
    photo_uri = state.get("photo_data_uri")
    attempts = state.get("attempts", [])

    result = await classify_skin_lesion_bytes_hf(photo_uri)
    if result.get("success") and result.get("top_prediction"):
        return {
            "condition_name": _humanize_ham10000_label(result.get("top_prediction")),
            "turn_count": 0,
            "success": True,
        }

    combined = "; ".join(attempts + [f"HuggingFace: {result.get('error', 'classification failed')}"])
    raise RuntimeError(f"Vision detection failed on all providers. {combined}")

def _build_detect_graph():
    workflow = StateGraph(DermatologyState)
    workflow.add_node("try_gemini", _detect_try_gemini)
    workflow.add_node("try_openai", _detect_try_openai)
    workflow.add_node("try_hf", _detect_try_hf)
    workflow.set_entry_point("try_gemini")
    workflow.add_conditional_edges(
        "try_gemini",
        lambda s: "done" if s.get("success") else "fallback",
        {"done": END, "fallback": "try_openai"},
    )
    workflow.add_conditional_edges(
        "try_openai",
        lambda s: "done" if s.get("success") else "fallback",
        {"done": END, "fallback": "try_hf"},
    )
    workflow.add_edge("try_hf", END)
    return workflow.compile()

detect_graph = _build_detect_graph()

# =====================================================================
# Graph 2: Dynamic Proforma Question Generation
#   try_gemini -> try_openai -> try_hf -> END (or raise on total failure)
# =====================================================================

def _question_system_instruction(condition_name: str) -> str:
    return f"""You are an expert board-certified dermatologist AI conducting a real-time clinical diagnostic consultation.
The primary differential identified from visual analysis is **{condition_name}**.

Your objective is to ask ONE thoughtful, highly relevant clinical follow-up question to investigate:
- Specific morphological symptoms, progression, and timeline.
- Sensations (itching severity, burning, soreness, bleeding).
- Potential triggers, lifestyle factors, contact exposures, or medications.
- Personal or family dermatological/allergic history.
- Response to any previous treatments.

Rules:
1. Formulate the question strictly based on the patient's conversation history.
2. Never repeat a question or topic already answered by the patient.
3. Tailor the medical inquiry specifically to the nuances of {condition_name}.
4. Ask only ONE clear, compassionate question without extra conversational preamble."""

def _question_user_prompt(history: str, condition_name: str) -> str:
    return f"""Conversation History so far:
{history}

Based on the above patient history and the suspected condition ({condition_name}), ask the single most important next clinical question:"""

async def _question_try_gemini(state: DermatologyState) -> Dict[str, Any]:
    condition_name = state.get("condition_name") or "Dermatological Condition"
    history = state.get("conversation_history") or ""
    system_instruction = _question_system_instruction(condition_name)
    user_prompt = _question_user_prompt(history, condition_name)

    try:
        model = _get_gemini_model("gemini-2.5-flash")
        if not model:
            raise RuntimeError("Gemini model not initialized")

        full_prompt = f"{system_instruction}\n\n{user_prompt}"
        response = await _gemini_generate_with_retry(model, full_prompt)
        question = response.text.strip().replace('"', '').replace("'", "")

        return {"current_question": question, "turn_count": state.get("turn_count", 0) + 1, "success": True}
    except Exception as e:
        print(f"[LangGraph Proforma Question Node Error — Gemini]: {e}")
        return {"success": False, "attempts": state.get("attempts", []) + [f"Gemini: {e}"]}

async def _question_try_openai(state: DermatologyState) -> Dict[str, Any]:
    condition_name = state.get("condition_name") or "Dermatological Condition"
    history = state.get("conversation_history") or ""
    system_instruction = _question_system_instruction(condition_name)
    user_prompt = _question_user_prompt(history, condition_name)
    attempts = state.get("attempts", [])

    openai_client = _get_openai_client()
    if not openai_client:
        return {"success": False, "attempts": attempts + ["OpenAI: OPENAI_API_KEY not configured"]}
    try:
        res = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=150
        )
        question = (res.choices[0].message.content or "").strip().replace('"', '')
        if question:
            return {"current_question": question, "turn_count": state.get("turn_count", 0) + 1, "success": True}
        return {"success": False, "attempts": attempts + ["OpenAI: returned empty question"]}
    except Exception as oai_err:
        print(f"[LangGraph OpenAI Question Fallback Error]: {oai_err}")
        return {"success": False, "attempts": attempts + [f"OpenAI: {oai_err}"]}

async def _question_try_hf(state: DermatologyState) -> Dict[str, Any]:
    """Real third-tier fallback: HuggingFace Mistral-7B-Instruct text completion
    (generate_llm_completion_hf, huggingface_service.py). Terminal node — on any
    failure here, raise so the combined error surfaces exactly like the other
    two tiers' failures, never a fabricated question."""
    condition_name = state.get("condition_name") or "Dermatological Condition"
    history = state.get("conversation_history") or ""
    attempts = state.get("attempts", [])
    combined_prompt = f"{_question_system_instruction(condition_name)}\n\n{_question_user_prompt(history, condition_name)}"

    try:
        completion = await generate_llm_completion_hf(combined_prompt)
        # Mistral is a raw completion model (no dedicated system/user roles), so
        # take the first non-empty line as the question rather than the whole
        # continuation, which may trail into unrelated text.
        question = next((line.strip() for line in (completion or "").splitlines() if line.strip()), "")
        question = question.replace('"', '')
        if not question:
            raise RuntimeError("HuggingFace returned an empty completion")
        return {"current_question": question, "turn_count": state.get("turn_count", 0) + 1, "success": True}
    except Exception as e:
        print(f"[LangGraph HF Question Fallback Error]: {e}")
        combined = "; ".join(attempts + [f"HuggingFace: {e}"])
        raise RuntimeError(f"Clinical question generation failed on all providers. {combined}") from e

def _build_question_graph():
    workflow = StateGraph(DermatologyState)
    workflow.add_node("try_gemini", _question_try_gemini)
    workflow.add_node("try_openai", _question_try_openai)
    workflow.add_node("try_hf", _question_try_hf)
    workflow.set_entry_point("try_gemini")
    workflow.add_conditional_edges(
        "try_gemini", lambda s: "done" if s.get("success") else "fallback", {"done": END, "fallback": "try_openai"}
    )
    workflow.add_conditional_edges(
        "try_openai", lambda s: "done" if s.get("success") else "fallback", {"done": END, "fallback": "try_hf"}
    )
    workflow.add_edge("try_hf", END)
    return workflow.compile()

question_graph = _build_question_graph()

# =====================================================================
# Graph 3: Multi-Agent Final Clinical Evaluation
#   try_gemini -> try_openai -> try_hf -> END (or raise on total failure)
# =====================================================================

def _eval_prompt(condition_name: str, user_answers: str) -> str:
    return f"""You are a world-class dermatologist AI. Your task is to perform a final, comprehensive evaluation of a skin condition.
You have already performed an initial analysis and determined the condition is likely {condition_name}.
You then conducted a proforma inquiry which the patient has answered.

Patient Data:
- Initial Detected Condition: {condition_name}
- Patient's Consultation Answers:
{user_answers}

Return a valid JSON object matching this exact structure:
{{
  "conditionName": "The final name of the most likely skin condition after full evaluation",
  "condition": "A detailed summary about the identified skin condition",
  "dos": ["List of 3 specific things the patient should do"],
  "donts": ["List of 3 specific things the patient should avoid"],
  "recommendations": "Detailed clinical recommendations and treatment pathways",
  "otherConsiderations": "A detailed analysis of differential diagnoses and alternative causes"
}}
Return ONLY valid JSON."""

def _extract_json_block(text: str) -> Dict[str, Any]:
    text = text.strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    return json.loads(text)

async def _eval_try_gemini(state: DermatologyState) -> Dict[str, Any]:
    condition_name = state.get("condition_name") or "Dermatological Condition"
    user_answers = state.get("user_answers") or state.get("conversation_history") or ""
    photo_uri = state.get("photo_data_uri")
    prompt = _eval_prompt(condition_name, user_answers)

    try:
        model = _get_gemini_model("gemini-2.5-flash")
        if not model:
            raise RuntimeError("Gemini model not initialized")

        contents: List[Any] = [prompt]
        if photo_uri and "," in photo_uri:
            mime_type, base64_data = _parse_photo_data_uri(photo_uri)
            contents.append({"mime_type": mime_type, "data": base64_data})

        response = await _gemini_generate_with_retry(model, contents)
        data = _extract_json_block(response.text)
        return {"final_evaluation": data, "success": True}
    except Exception as e:
        print(f"[LangGraph Final Eval Error — Gemini]: {e}")
        return {"success": False, "attempts": state.get("attempts", []) + [f"Gemini: {e}"]}

async def _eval_try_openai(state: DermatologyState) -> Dict[str, Any]:
    condition_name = state.get("condition_name") or "Dermatological Condition"
    user_answers = state.get("user_answers") or state.get("conversation_history") or ""
    photo_uri = state.get("photo_data_uri")
    prompt = _eval_prompt(condition_name, user_answers)
    attempts = state.get("attempts", [])

    openai_client = _get_openai_client()
    if not openai_client:
        return {"success": False, "attempts": attempts + ["OpenAI: OPENAI_API_KEY not configured"]}
    try:
        content: List[Any] = [{"type": "text", "text": prompt}]
        if photo_uri:
            content.append({"type": "image_url", "image_url": {"url": photo_uri}})
        res = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": content}],
            response_format={"type": "json_object"},
            max_tokens=1200,
        )
        data = json.loads((res.choices[0].message.content or "").strip())
        return {"final_evaluation": data, "success": True}
    except Exception as oai_err:
        print(f"[LangGraph OpenAI Final Eval Fallback Error]: {oai_err}")
        return {"success": False, "attempts": attempts + [f"OpenAI: {oai_err}"]}

async def _eval_try_hf(state: DermatologyState) -> Dict[str, Any]:
    """Real third-tier fallback: HuggingFace Mistral-7B text completion, text-only
    (no image — Mistral-7B-Instruct is not multimodal, so the visual context
    that Gemini/OpenAI had is simply unavailable on this tier; the synthesis is
    still based on real patient-answer text, never fabricated). Terminal node —
    raises on any failure, including unparseable JSON, so a malformed HF
    completion never becomes a fabricated clinical report."""
    condition_name = state.get("condition_name") or "Dermatological Condition"
    user_answers = state.get("user_answers") or state.get("conversation_history") or ""
    attempts = state.get("attempts", [])
    prompt = _eval_prompt(condition_name, user_answers)

    try:
        completion = await generate_llm_completion_hf(prompt)
        data = _extract_json_block(completion)
        return {"final_evaluation": data, "success": True}
    except Exception as e:
        print(f"[LangGraph HF Final Eval Fallback Error]: {e}")
        combined = "; ".join(attempts + [f"HuggingFace: {e}"])
        raise RuntimeError(f"Final clinical evaluation failed on all providers. {combined}") from e

def _build_eval_graph():
    workflow = StateGraph(DermatologyState)
    workflow.add_node("try_gemini", _eval_try_gemini)
    workflow.add_node("try_openai", _eval_try_openai)
    workflow.add_node("try_hf", _eval_try_hf)
    workflow.set_entry_point("try_gemini")
    workflow.add_conditional_edges(
        "try_gemini", lambda s: "done" if s.get("success") else "fallback", {"done": END, "fallback": "try_openai"}
    )
    workflow.add_conditional_edges(
        "try_openai", lambda s: "done" if s.get("success") else "fallback", {"done": END, "fallback": "try_hf"}
    )
    workflow.add_edge("try_hf", END)
    return workflow.compile()

eval_graph = _build_eval_graph()

# =====================================================================
# Exported Execution Helpers for FastAPI
# =====================================================================
async def execute_langgraph_detect(photo_data_uri: str) -> Dict[str, Any]:
    """Execute the compiled LangGraph vision condition-detection graph."""
    initial_state: DermatologyState = {
        "photo_data_uri": photo_data_uri,
        "turn_count": 0,
        "attempts": [],
    }
    final_state = await detect_graph.ainvoke(initial_state)
    return {
        "condition_name": final_state.get("condition_name", "Dermatological Condition"),
        "turn_count": final_state.get("turn_count", 0),
    }

async def execute_langgraph_question(condition_name: str, conversation_history: str) -> Dict[str, Any]:
    """Execute the compiled LangGraph dynamic-question-generation graph."""
    initial_state: DermatologyState = {
        "condition_name": condition_name,
        "conversation_history": conversation_history,
        "turn_count": 0,
        "attempts": [],
    }
    final_state = await question_graph.ainvoke(initial_state)
    return {
        "current_question": final_state.get("current_question", ""),
        "turn_count": final_state.get("turn_count", 1),
    }

async def execute_langgraph_evaluation(initial_condition: str, user_answers: str, photo_data_uri: Optional[str] = None) -> Dict[str, Any]:
    """Execute the compiled LangGraph final-evaluation-synthesis graph."""
    initial_state: DermatologyState = {
        "photo_data_uri": photo_data_uri,
        "condition_name": initial_condition,
        "user_answers": user_answers,
        "turn_count": 0,
        "attempts": [],
    }
    final_state = await eval_graph.ainvoke(initial_state)
    return {"final_evaluation": final_state.get("final_evaluation", {})}

async def execute_langgraph_suggestions(question: str, condition_name: Optional[str] = None, conversation_history: Optional[str] = None) -> Dict[str, Any]:
    """Execute Python AI suggestions agent to generate 3-4 tailored response options.

    Low-stakes UI quick-replies, not a diagnostic step — no graph needed here
    (per the original design), just a direct Gemini-then-OpenAI attempt with an
    honest empty-list fallback (never fabricated chips) if both are unavailable.
    """
    prompt = f"""You are a specialized clinical assistant AI agent for DermiAssist-AI.
Your role is to generate 3 to 4 realistic, distinct, concise patient response options (2 to 6 words each) for a patient answering the following clinical question.

Condition: {condition_name or 'Dermatological Condition'}
Question to the Patient: "{question}"
Context: {conversation_history or 'Initial turn'}

Rules:
1. Every option must directly and naturally answer the specific question asked.
2. Return ONLY a JSON list of 3-4 strings. Example: ["Option 1", "Option 2", "Option 3"]
"""
    try:
        model = _get_gemini_model("gemini-2.5-flash")
        if model:
            res = await _gemini_generate_with_retry(model, prompt)
            text = res.text.strip()
            # Extract JSON array
            match = re.search(r'\[.*\]', text, re.DOTALL)
            if match:
                suggestions = json.loads(match.group(0))
                if isinstance(suggestions, list) and len(suggestions) > 0:
                    return {"suggestions": [str(s) for s in suggestions[:4]]}
    except Exception as e:
        print(f"[LangGraph Suggestions Agent Error]: {e}")
        openai_client = _get_openai_client()
        if openai_client:
            try:
                res = await openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=100
                )
                text = res.choices[0].message.content.strip()
                match = re.search(r'\[.*\]', text, re.DOTALL)
                if match:
                    suggestions = json.loads(match.group(0))
                    if isinstance(suggestions, list) and len(suggestions) > 0:
                        return {"suggestions": [str(s) for s in suggestions[:4]]}
            except Exception as oai_err:
                print(f"[LangGraph Suggestions OpenAI Fallback Error]: {oai_err}")

    # Suggestions are non-diagnostic UI quick-replies. Rather than fake them
    # (which would hide that the model is down), return none with an explicit
    # error so the UI degrades to free-text entry instead of canned chips.
    return {"suggestions": [], "error": "Suggestion model unavailable"}
