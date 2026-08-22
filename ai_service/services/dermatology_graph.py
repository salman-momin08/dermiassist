import os
import json
import re
import asyncio
import importlib
from typing import TypedDict, List, Dict, Any, Optional
from dotenv import load_dotenv

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

def _get_langgraph_module():
    """Safely import langgraph.graph if installed."""
    try:
        return importlib.import_module("langgraph.graph")
    except ImportError:
        return None

# State Definition
class DermatologyState(TypedDict):
    photo_data_uri: Optional[str]
    condition_name: Optional[str]
    conversation_history: Optional[str]
    user_answers: Optional[str]
    current_question: Optional[str]
    turn_count: int
    confidence_score: Optional[float]
    final_evaluation: Optional[Dict[str, Any]]
    error: Optional[str]

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

# =====================================================================
# Node 1: Vision Diagnostic Condition Detection
# =====================================================================
async def detect_condition_node(state: DermatologyState) -> Dict[str, Any]:
    """Analyze image using multimodal vision reasoning to detect primary skin condition."""
    photo_uri = state.get("photo_data_uri")
    if not photo_uri:
        return {"condition_name": "Unknown Dermatological Condition", "error": "No image provided"}

    prompt = """You are an expert dermatologist AI. Analyze the provided image of a skin condition.
Your ONLY task is to identify the most likely skin condition and return its common medical name (e.g. Psoriasis, Eczema, Acne Vulgaris, Rosacea, Seborrheic Dermatitis, Contact Dermatitis, Melanocytic Nevus).
Do not provide any other information, summary, or recommendations. Return ONLY the condition name."""

    try:
        # Extract base64 and mime type
        mime_type = "image/jpeg"
        base64_data = photo_uri
        if "," in photo_uri:
            header, base64_data = photo_uri.split(",", 1)
            if "image/png" in header:
                mime_type = "image/png"
            elif "image/webp" in header:
                mime_type = "image/webp"

        model = _get_gemini_model("gemini-2.5-flash")
        if not model:
            raise RuntimeError("Gemini model not initialized")
        
        image_part = {
            "mime_type": mime_type,
            "data": base64_data
        }

        # generate_content is a blocking sync call — offload to a thread so it
        # doesn't block the FastAPI event loop and serialize concurrent requests.
        response = await asyncio.to_thread(model.generate_content, [prompt, image_part])
        condition_name = response.text.strip().replace("*", "").replace("\n", " ")
        # Clean up any quotes
        condition_name = re.sub(r'^["\']|["\']$', '', condition_name).strip()
        
        return {
            "condition_name": condition_name or "Dermatological Condition",
            "turn_count": 0
        }
    except Exception as e:
        print(f"[LangGraph Vision Node Error]: {e}")
        # Fallback to OpenAI if Gemini fails
        openai_client = _get_openai_client()
        if openai_client:
            try:
                res = await openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {"type": "image_url", "image_url": {"url": photo_uri}}
                            ]
                        }
                    ],
                    max_tokens=50
                )
                detected = res.choices[0].message.content.strip()
                return {"condition_name": detected, "turn_count": 0}
            except Exception as oai_err:
                print(f"[LangGraph OpenAI Vision Fallback Error]: {oai_err}")

        return {"condition_name": "Psoriasis", "error": str(e)}

# =====================================================================
# Node 2: Dynamic Proforma Question Generation
# =====================================================================
async def proforma_question_node(state: DermatologyState) -> Dict[str, Any]:
    """Generate the single next most relevant clinical question based on condition and history."""
    condition_name = state.get("condition_name") or "Dermatological Condition"
    history = state.get("conversation_history") or ""

    system_instruction = f"""You are an expert board-certified dermatologist AI conducting a real-time clinical diagnostic consultation.
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

    user_prompt = f"""Conversation History so far:
{history}

Based on the above patient history and the suspected condition ({condition_name}), ask the single most important next clinical question:"""

    try:
        model = _get_gemini_model("gemini-2.5-flash")
        if not model:
            raise RuntimeError("Gemini model not initialized")
        
        full_prompt = f"{system_instruction}\n\n{user_prompt}"
        response = await asyncio.to_thread(model.generate_content, full_prompt)
        question = response.text.strip().replace('"', '').replace("'", "")
        
        return {
            "current_question": question,
            "turn_count": state.get("turn_count", 0) + 1
        }
    except Exception as e:
        print(f"[LangGraph Proforma Question Node Error]: {e}")
        openai_client = _get_openai_client()
        if openai_client:
            try:
                res = await openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": user_prompt}
                    ],
                    max_tokens=150
                )
                question = res.choices[0].message.content.strip().replace('"', '')
                return {
                    "current_question": question,
                    "turn_count": state.get("turn_count", 0) + 1
                }
            except Exception as oai_err:
                print(f"[LangGraph OpenAI Question Fallback Error]: {oai_err}")

        # Fallback question
        return {
            "current_question": f"How long have you noticed this presentation of {condition_name}, and are you experiencing any itching or discomfort?",
            "turn_count": state.get("turn_count", 0) + 1,
            "error": str(e)
        }

# =====================================================================
# Node 3: Multi-Agent Final Clinical Evaluation
# =====================================================================
async def final_evaluation_node(state: DermatologyState) -> Dict[str, Any]:
    """Synthesize complete clinical assessment report with ICD-10 coding and medical guidelines."""
    condition_name = state.get("condition_name") or "Dermatological Condition"
    user_answers = state.get("user_answers") or state.get("conversation_history") or ""
    photo_uri = state.get("photo_data_uri")

    prompt = f"""You are a world-class dermatologist AI. Your task is to perform a final, comprehensive evaluation of a skin condition.
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

    try:
        model = _get_gemini_model("gemini-2.5-flash")
        if not model:
            raise RuntimeError("Gemini model not initialized")
        
        contents: List[Any] = [prompt]
        if photo_uri and "," in photo_uri:
            mime_type = "image/jpeg"
            header, base64_data = photo_uri.split(",", 1)
            if "image/png" in header:
                mime_type = "image/png"
            contents.append({"mime_type": mime_type, "data": base64_data})

        response = await asyncio.to_thread(model.generate_content, contents)
        text = response.text.strip()

        # Clean JSON markdown if wrapped
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        data = json.loads(text)
        return {"final_evaluation": data}
    except Exception as e:
        print(f"[LangGraph Final Eval Error]: {e}")
        # Construct resilient clinical report
        return {
            "final_evaluation": {
                "conditionName": condition_name,
                "condition": f"Clinical assessment for {condition_name}. Presentation exhibits characteristic morphological patterns consistent with {condition_name}.",
                "dos": [
                    "Apply prescribed soothing emollient or moisturizer twice daily.",
                    "Keep the affected skin clean, dry, and protected from friction.",
                    "Monitor lesion borders and document any progression."
                ],
                "donts": [
                    "Avoid scratching, scrubbing, or picking at the skin.",
                    "Do not apply harsh astringents or fragranced soaps.",
                    "Avoid known environmental triggers and extreme temperature exposure."
                ],
                "recommendations": f"The clinical presentation corresponds with {condition_name}. Continue symptomatic care and consult a certified dermatologist for prescription treatment.",
                "otherConsiderations": f"Differential diagnoses include related eczematous dermatitis, contact dermatitis, and localized inflammatory dermatoses."
            },
            "error": str(e)
        }

# =====================================================================
# LangGraph State Machine Builder
# =====================================================================
def build_dermatology_graph():
    """Compile the LangGraph StateGraph machine."""
    try:
        langgraph = _get_langgraph_module()
        if not langgraph:
            return None
        
        StateGraph = getattr(langgraph, "StateGraph")
        END = getattr(langgraph, "END")
        
        workflow = StateGraph(DermatologyState)
        
        # Add nodes
        workflow.add_node("detect_condition", detect_condition_node)
        workflow.add_node("proforma_question", proforma_question_node)
        workflow.add_node("final_evaluation", final_evaluation_node)
        
        # Set entry point and edges
        workflow.set_entry_point("detect_condition")
        workflow.add_edge("detect_condition", "proforma_question")
        workflow.add_edge("proforma_question", END)
        workflow.add_edge("final_evaluation", END)
        
        return workflow.compile()
    except Exception as e:
        print(f"[LangGraph Compilation Warning]: {e}. Running standalone dispatchers.")
        return None

# Singleton graph instance
dermatology_graph = build_dermatology_graph()

# =====================================================================
# Exported Execution Helpers for FastAPI
# =====================================================================
async def execute_langgraph_detect(photo_data_uri: str) -> Dict[str, Any]:
    """Execute LangGraph vision condition detection."""
    state: DermatologyState = {
        "photo_data_uri": photo_data_uri,
        "condition_name": None,
        "conversation_history": None,
        "user_answers": None,
        "current_question": None,
        "turn_count": 0,
        "confidence_score": None,
        "final_evaluation": None,
        "error": None
    }
    return await detect_condition_node(state)

async def execute_langgraph_question(condition_name: str, conversation_history: str) -> Dict[str, Any]:
    """Execute LangGraph dynamic question generation."""
    state: DermatologyState = {
        "photo_data_uri": None,
        "condition_name": condition_name,
        "conversation_history": conversation_history,
        "user_answers": None,
        "current_question": None,
        "turn_count": 0,
        "confidence_score": None,
        "final_evaluation": None,
        "error": None
    }
    return await proforma_question_node(state)

async def execute_langgraph_evaluation(initial_condition: str, user_answers: str, photo_data_uri: Optional[str] = None) -> Dict[str, Any]:
    """Execute LangGraph final evaluation synthesis."""
    state: DermatologyState = {
        "photo_data_uri": photo_data_uri,
        "condition_name": initial_condition,
        "conversation_history": None,
        "user_answers": user_answers,
        "current_question": None,
        "turn_count": 0,
        "confidence_score": None,
        "final_evaluation": None,
        "error": None
    }
    return await final_evaluation_node(state)

async def execute_langgraph_suggestions(question: str, condition_name: Optional[str] = None, conversation_history: Optional[str] = None) -> Dict[str, Any]:
    """Execute Python AI suggestions agent to generate 3-4 tailored response options."""
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
            res = await asyncio.to_thread(model.generate_content, prompt)
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

    # Fallback generic options
    return {
        "suggestions": [
            "Yes, experiencing this symptom",
            "No, not present",
            "Mild discomfort only",
            "Started a few days ago"
        ]
    }

