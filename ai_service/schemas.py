"""
Pydantic Schemas for DermiAssist-AI FastAPI Microservice.
Provides strict request/response data validation and automatic OpenAPI docs.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# ── 1. ANALYSIS PIPELINE SCHEMAS ──────────────────────────────────

class AnalysisRequest(BaseModel):
    symptoms: str = Field(..., description="Detailed patient symptoms, onset, and duration.", example="Itchy red elevated rash on inner elbows for 3 weeks")
    image_url: Optional[str] = Field(None, description="Cloudinary URL of lesion photo")
    body_location: Optional[str] = Field(None, description="Body location of lesion", example="inner arms")

class DiagnosticReport(BaseModel):
    primary_condition_name: str
    icd_code: str
    severity: str  # Mild | Moderate | Severe
    confidence_score: float
    summary: str
    key_findings: List[str]
    recommended_treatments: List[str]
    citations_used: List[str]
    disclaimer: str

class AgentTraceStep(BaseModel):
    agent: str
    duration_ms: float
    status: str

class AnalysisResponse(BaseModel):
    success: bool
    execution_time_ms: float
    cached: bool
    report: DiagnosticReport
    agent_trace: List[AgentTraceStep]

# ── 2. RAG VECTOR SEARCH SCHEMAS ─────────────────────────────────

class RAGQueryRequest(BaseModel):
    query: str = Field(..., description="Dermatological query or disease category", example="Eczema treatment guidelines")
    category_filter: Optional[str] = Field(None, description="Filter by condition category (Acne, Eczema, Psoriasis, Fungal, Melanoma)")
    match_count: int = Field(3, ge=1, le=10)

class RAGChunk(BaseModel):
    id: str
    title: str
    condition_category: str
    content: str
    source: str
    icd_code: Optional[str] = None
    similarity: float

class RAGQueryResponse(BaseModel):
    success: bool
    query: str
    matched_chunks: List[RAGChunk]
    grounding_prompt_text: str

# ── 3. AGENT TOOLS SCHEMAS ───────────────────────────────────────

class DrugInteractionRequest(BaseModel):
    topical_medication: str = Field(..., example="Benzoyl Peroxide")
    oral_medication: Optional[str] = Field(None, example="Isotretinoin")

class DrugInteractionResponse(BaseModel):
    safe_to_combine: bool
    interaction_risk_level: str  # none | moderate | severe
    warning_message: str
    recommended_spacing_hours: Optional[int] = None

class DoctorQueryRequest(BaseModel):
    specialty: Optional[str] = Field(None, example="General Dermatology")
    city: Optional[str] = Field(None, example="New York")

class DoctorSlot(BaseModel):
    doctor_id: str
    doctor_name: str
    specialization: str
    location: str
    next_available_slot: str

class DoctorQueryResponse(BaseModel):
    doctors: List[DoctorSlot]

# ── 4. LONGITUDINAL HEALING SCHEMAS ──────────────────────────────

class HealingTrackRequest(BaseModel):
    initial_image_url: str = Field(..., description="Baseline lesion photo Cloudinary URL")
    current_image_url: str = Field(..., description="Follow-up lesion photo Cloudinary URL")
    days_elapsed: int = Field(14, ge=1, le=365, description="Days between baseline and follow-up photo")

class HealingMetrics(BaseModel):
    surface_area_reduction_percentage: float
    erythema_fading_index: float
    healing_velocity_score: float
    clinical_trajectory: str

# ── 5. LANGGRAPH MULTI-AGENT DIAGNOSTIC SCHEMAS ──────────────────

class LangGraphDetectRequest(BaseModel):
    photo_data_uri: str = Field(..., description="Base64 data URI of the skin lesion photo")

class LangGraphDetectResponse(BaseModel):
    condition_name: str
    turn_count: int = 0
    error: Optional[str] = None

class LangGraphQuestionRequest(BaseModel):
    condition_name: str = Field(..., description="Detected skin condition name")
    conversation_history: str = Field(..., description="Conversation transcript formatted as AI/User turns")

class LangGraphQuestionResponse(BaseModel):
    next_question: str
    turn_count: int = 0
    error: Optional[str] = None

class LangGraphEvalRequest(BaseModel):
    initial_condition: str = Field(..., description="Initial diagnosed condition")
    user_answers: str = Field(..., description="Full consultation answers string")
    photo_data_uri: Optional[str] = Field(None, description="Optional original photo data URI")

class LangGraphEvalResponse(BaseModel):
    conditionName: str
    condition: str
    dos: List[str]
    donts: List[str]
    recommendations: str
    otherConsiderations: str
    error: Optional[str] = None

class LangGraphSuggestionsRequest(BaseModel):
    question: str = Field(..., description="The clinical question asked")
    condition_name: Optional[str] = Field(None, description="Suspected condition name")
    conversation_history: Optional[str] = Field(None, description="Conversation transcript context")

class LangGraphSuggestionsResponse(BaseModel):
    suggestions: List[str] = Field(default_factory=list, description="3-4 dynamic, tailored patient response options")
    error: Optional[str] = None



