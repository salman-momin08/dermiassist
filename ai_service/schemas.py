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

class HealingTrackResponse(BaseModel):
    success: bool
    days_elapsed: int
    metrics: HealingMetrics
    baseline_assessment: Dict[str, Any]
    followup_assessment: Dict[str, Any]
    recommendations: List[str]
    processing_time_ms: float

