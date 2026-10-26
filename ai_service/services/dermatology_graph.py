import json
import re
from typing import TypedDict, List, Dict, Any, Optional
from dotenv import load_dotenv

from langgraph.graph import StateGraph, END

from ai_service.services.huggingface_service import (
    generate_llm_completion_hf,
    classify_skin_lesion_bytes_hf,
)
from ai_service.services.hf_client import (
    hf_token_configured,
    hf_chat_completion,
    hf_vision_chat,
    HF_REASONING_MODEL,
    HF_VISION_MODEL,
)

load_dotenv()

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
    # the terminal node's raised error mirrors the combined
    # "failed on all providers. ..." message.
    success: bool
    attempts: List[str]

# Quota / limit-exhaustion markers. On a free tier these won't recover within
# our short retry window, so retrying with backoff just wastes seconds — we fall
# straight through to the next tier instead.
_QUOTA_MARKERS = (
    "429", "rate limit", "resource_exhausted", "quota", "exhausted",
    "insufficient_quota", "billing",
)

# Genuinely transient markers (server overloaded / network blip) worth a brief
# retry before falling through to the next tier.
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

# =====================================================================
# Graph 1: Vision Diagnostic Condition Detection
#   try_hf_vision --(success)--> END
#   try_hf_vision --(failure)--> try_hf_classifier --(success)--> END
#   try_hf_classifier --(failure)--> raises (terminal, no fabricated condition)
#
# Tier 1 is an open-source vision-language instruct model (open-vocabulary
# condition name). Tier 2 is the HuggingFace HAM10000 lesion classifier — a
# genuine last-resort fallback whose 7-class lesion taxonomy is mapped to a
# readable condition name. Both are REAL model predictions, never a guess.
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

async def _detect_try_hf_vision(state: DermatologyState) -> Dict[str, Any]:
    """Node 1a: open-source vision-language model — the primary condition detector.

    Non-terminal: on failure it returns success=False so the graph falls through
    to the HAM10000 lesion classifier instead of dead-ending here.
    """
    photo_uri = state.get("photo_data_uri")
    attempts = state.get("attempts", [])
    if not photo_uri:
        raise ValueError("No image provided for condition detection")
    if not hf_token_configured():
        return {"success": False, "attempts": attempts + ["Hugging Face: HF_TOKEN not configured"]}

    try:
        text = await hf_vision_chat(_DETECT_PROMPT, photo_uri, model=HF_VISION_MODEL, max_tokens=50)
        condition_name = (text or "").strip().replace("*", "").replace("\n", " ")
        condition_name = re.sub(r'^["\']|["\']$', '', condition_name).strip()
        if condition_name:
            return {"condition_name": condition_name, "turn_count": 0, "success": True}
        return {"success": False, "attempts": attempts + ["Hugging Face: returned empty condition"]}
    except Exception as e:
        print(f"[LangGraph Vision Node Error — Hugging Face]: {e}")
        return {"success": False, "attempts": attempts + [f"Hugging Face: {e}"]}

async def _detect_try_classifier(state: DermatologyState) -> Dict[str, Any]:
    """Node 1b: HuggingFace HAM10000 lesion classifier — real open-source
    last-resort vision fallback when the vision-language model is unavailable
    (e.g. not warm on the serverless provider). Terminal node: raises on failure
    so no fabricated condition is ever returned."""
    photo_uri = state.get("photo_data_uri")
    attempts = state.get("attempts", [])

    result = await classify_skin_lesion_bytes_hf(photo_uri)
    if result.get("success") and result.get("top_prediction"):
        return {
            "condition_name": _humanize_ham10000_label(result.get("top_prediction")),
            "turn_count": 0,
            "success": True,
        }

    combined = "; ".join(attempts + [f"HuggingFace classifier: {result.get('error', 'classification failed')}"])
    raise RuntimeError(f"Vision detection failed on all providers. {combined}")

def _build_detect_graph():
    workflow = StateGraph(DermatologyState)
    workflow.add_node("try_hf_vision", _detect_try_hf_vision)
    workflow.add_node("try_hf_classifier", _detect_try_classifier)
    workflow.set_entry_point("try_hf_vision")
    workflow.add_conditional_edges(
        "try_hf_vision",
        lambda s: "done" if s.get("success") else "fallback",
        {"done": END, "fallback": "try_hf_classifier"},
    )
    workflow.add_edge("try_hf_classifier", END)
    return workflow.compile()

detect_graph = _build_detect_graph()

# =====================================================================
# Graph 2: Dynamic Proforma Question Generation
#   try_hf_primary -> try_hf_fallback -> END (or raise on total failure)
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

async def _question_try_hf_primary(state: DermatologyState) -> Dict[str, Any]:
    """Node 2a: primary open-source reasoning model for the next clinical question."""
    condition_name = state.get("condition_name") or "Dermatological Condition"
    history = state.get("conversation_history") or ""
    system_instruction = _question_system_instruction(condition_name)
    user_prompt = _question_user_prompt(history, condition_name)
    attempts = state.get("attempts", [])

    if not hf_token_configured():
        return {"success": False, "attempts": attempts + ["Hugging Face: HF_TOKEN not configured"]}
    try:
        text = await hf_chat_completion(
            [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt},
            ],
            model=HF_REASONING_MODEL,
            max_tokens=150,
        )
        question = (text or "").strip().replace('"', '').replace("'", "")
        if question:
            return {"current_question": question, "turn_count": state.get("turn_count", 0) + 1, "success": True}
        return {"success": False, "attempts": attempts + ["Hugging Face: returned empty question"]}
    except Exception as e:
        print(f"[LangGraph Proforma Question Node Error — Hugging Face]: {e}")
        return {"success": False, "attempts": attempts + [f"Hugging Face: {e}"]}

async def _question_try_hf_fallback(state: DermatologyState) -> Dict[str, Any]:
    """Node 2b: secondary open-source fallback (Mistral-7B-Instruct text
    completion via generate_llm_completion_hf). Terminal node — on any failure
    here, raise so the combined error surfaces exactly like the primary tier's
    failure, never a fabricated question."""
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
        combined = "; ".join(attempts + [f"HuggingFace fallback: {e}"])
        raise RuntimeError(f"Clinical question generation failed on all providers. {combined}") from e

def _build_question_graph():
    workflow = StateGraph(DermatologyState)
    workflow.add_node("try_hf_primary", _question_try_hf_primary)
    workflow.add_node("try_hf_fallback", _question_try_hf_fallback)
    workflow.set_entry_point("try_hf_primary")
    workflow.add_conditional_edges(
        "try_hf_primary", lambda s: "done" if s.get("success") else "fallback", {"done": END, "fallback": "try_hf_fallback"}
    )
    workflow.add_edge("try_hf_fallback", END)
    return workflow.compile()

question_graph = _build_question_graph()

# =====================================================================
# Graph 3: Multi-Agent Final Clinical Evaluation
#   try_hf_primary -> try_hf_fallback -> END (or raise on total failure)
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

async def _eval_try_hf_primary(state: DermatologyState) -> Dict[str, Any]:
    """Node 3a: primary open-source reasoning model, returning structured JSON.

    If a photo is present and the configured vision model is multimodal, the
    image is attached for visual grounding; otherwise the synthesis is based on
    the real patient-answer text.
    """
    condition_name = state.get("condition_name") or "Dermatological Condition"
    user_answers = state.get("user_answers") or state.get("conversation_history") or ""
    photo_uri = state.get("photo_data_uri")
    prompt = _eval_prompt(condition_name, user_answers)
    attempts = state.get("attempts", [])

    if not hf_token_configured():
        return {"success": False, "attempts": attempts + ["Hugging Face: HF_TOKEN not configured"]}
    try:
        if photo_uri and "," in photo_uri:
            content: List[Any] = [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": photo_uri}},
            ]
            messages = [{"role": "user", "content": content}]
            model_id = HF_VISION_MODEL
        else:
            messages = [{"role": "user", "content": prompt}]
            model_id = HF_REASONING_MODEL

        text = await hf_chat_completion(
            messages,
            model=model_id,
            max_tokens=1200,
            response_format={"type": "json_object"},
        )
        data = _extract_json_block(text)
        return {"final_evaluation": data, "success": True}
    except Exception as e:
        print(f"[LangGraph Final Eval Error — Hugging Face]: {e}")
        return {"success": False, "attempts": attempts + [f"Hugging Face: {e}"]}

async def _eval_try_hf_fallback(state: DermatologyState) -> Dict[str, Any]:
    """Node 3b: secondary open-source fallback — Mistral-7B text completion,
    text-only (no image). Terminal node — raises on any failure, including
    unparseable JSON, so a malformed completion never becomes a fabricated
    clinical report."""
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
        combined = "; ".join(attempts + [f"HuggingFace fallback: {e}"])
        raise RuntimeError(f"Final clinical evaluation failed on all providers. {combined}") from e

def _build_eval_graph():
    workflow = StateGraph(DermatologyState)
    workflow.add_node("try_hf_primary", _eval_try_hf_primary)
    workflow.add_node("try_hf_fallback", _eval_try_hf_fallback)
    workflow.set_entry_point("try_hf_primary")
    workflow.add_conditional_edges(
        "try_hf_primary", lambda s: "done" if s.get("success") else "fallback", {"done": END, "fallback": "try_hf_fallback"}
    )
    workflow.add_edge("try_hf_fallback", END)
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

    Low-stakes UI quick-replies, not a diagnostic step — a direct open-source
    Hugging Face chat call with an honest empty-list fallback (never fabricated
    chips) if the model is unavailable.
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
    if hf_token_configured():
        try:
            text = await hf_chat_completion(
                [{"role": "user", "content": prompt}],
                model=HF_REASONING_MODEL,
                max_tokens=100,
            )
            match = re.search(r'\[.*\]', text or "", re.DOTALL)
            if match:
                suggestions = json.loads(match.group(0))
                if isinstance(suggestions, list) and len(suggestions) > 0:
                    return {"suggestions": [str(s) for s in suggestions[:4]]}
        except Exception as e:
            print(f"[LangGraph Suggestions Agent Error]: {e}")

    # Suggestions are non-diagnostic UI quick-replies. Rather than fake them
    # (which would hide that the model is down), return none with an explicit
    # error so the UI degrades to free-text entry instead of canned chips.
    return {"suggestions": [], "error": "Suggestion model unavailable"}
