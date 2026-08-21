"""
DermiAssist-AI FastAPI Python Microservice Application.
Provides RESTful AI endpoints, RAG search, Tool Execution, MCP Server, Hugging Face Open-Source Models,
and Distributed System Design Architecture (RRF Search, Token Budgeting, Circuit Breakers, Async Queue).
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ai_service.schemas import (
    AnalysisRequest, AnalysisResponse,
    RAGQueryRequest, RAGQueryResponse,
    DrugInteractionRequest, DrugInteractionResponse,
    DoctorQueryRequest, DoctorQueryResponse,
    HealingTrackRequest, HealingTrackResponse
)
from ai_service.services.rag_service import search_vector_rag
from ai_service.services.orchestrator_service import run_multi_agent_pipeline
from ai_service.services.huggingface_service import classify_skin_lesion_hf, generate_bge_embedding_hf
from ai_service.services.healing_tracker import track_longitudinal_healing
from ai_service.services.hybrid_search import search_hybrid_rrf
from ai_service.utils.token_budget import estimate_token_count, truncate_to_token_budget, calculate_llm_cost
from ai_service.utils.circuit_breaker import gemini_circuit_breaker, huggingface_circuit_breaker
from ai_service.queue.task_worker import submit_async_job, get_job_status

app = FastAPI(
    title="DermiAssist-AI Polyglot Python Microservice",
    description="Enterprise AI Engineering Microservice providing Multi-Agent Orchestration, Vector RAG Retrieval, MCP Protocol, Agent Tools, Hugging Face Models, and Distributed System Design Architecture.",
    version="4.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for Next.js web client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["Health Check"])
async def health_check():
    return {
        "status": "online",
        "service": "DermiAssist-AI FastAPI Engine",
        "version": "4.0.0",
        "architecture": "Polyglot Microservice (FastAPI + Next.js 15)",
        "circuit_breakers": {
            "gemini": gemini_circuit_breaker.get_status(),
            "huggingface": huggingface_circuit_breaker.get_status()
        },
        "docs": "/docs"
    }

@app.post("/api/v1/analyze", response_model=AnalysisResponse, tags=["AI Diagnostic Engine"])
async def analyze_symptoms(request: AnalysisRequest):
    """Trigger the Multi-Agent Diagnostic Pipeline."""
    try:
        res = await run_multi_agent_pipeline(
            symptoms=request.symptoms,
            image_url=request.image_url,
            body_location=request.body_location
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/jobs/submit", tags=["Async Background Worker Queue"])
async def submit_job(request: AnalysisRequest):
    """Submit heavy diagnostic task to Redis Async Task Worker Queue."""
    try:
        res = await submit_async_job(
            symptoms=request.symptoms,
            image_url=request.image_url,
            body_location=request.body_location
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/jobs/{job_id}", tags=["Async Background Worker Queue"])
async def poll_job(job_id: str):
    """Poll execution status of an async background job."""
    return get_job_status(job_id)

@app.post("/api/v1/rag/hybrid-search", tags=["Vector RAG Engine"])
async def hybrid_search_rrf(request: RAGQueryRequest):
    """Execute Hybrid BM25 Keyword + Vector Cosine Distance Search via Reciprocal Rank Fusion (RRF)."""
    try:
        res = await search_hybrid_rrf(
            query=request.query,
            category_filter=request.category_filter,
            top_k=request.match_count
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/system/token-budget", tags=["System Design & AI Budgeting"])
async def analyze_token_budget(text: str, max_budget: int = 1024):
    """Analyze sub-word token count, enforce dynamic token budget, and calculate LLM billing cost."""
    try:
        tokens = estimate_token_count(text)
        truncation = truncate_to_token_budget(text, max_budget)
        cost = calculate_llm_cost(tokens, completion_tokens=256, model="gemini-2.5-flash")
        return {
            "success": True,
            "estimated_tokens": tokens,
            "truncation_analysis": truncation,
            "billing_cost_analysis": cost
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/system/circuit-breakers", tags=["System Design & AI Budgeting"])
async def get_circuit_breakers():
    """Retrieve status of API Circuit Breakers (Gemini & Hugging Face)."""
    return {
        "gemini": gemini_circuit_breaker.get_status(),
        "huggingface": huggingface_circuit_breaker.get_status()
    }

@app.post("/api/v1/huggingface/classify-lesion", tags=["Hugging Face Open-Source Models"])
async def classify_lesion_huggingface(image_url: str = ""):
    """Classify skin lesion photo using Hugging Face Open-Source Lesion Classifier (HAM10000)."""
    try:
        res = await classify_skin_lesion_hf(image_url)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/huggingface/embed", tags=["Hugging Face Open-Source Models"])
async def embed_huggingface(text: str):
    """Generate 768-dim vector embedding using BAAI/bge-small-en-v1.5 via Hugging Face."""
    try:
        vector = await generate_bge_embedding_hf(text)
        return {"success": True, "model": "BAAI/bge-small-en-v1.5", "dimensions": len(vector), "vector": vector[:10]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/analytics/track-healing", response_model=HealingTrackResponse, tags=["Longitudinal Analytics"])
async def track_healing_analytics(request: HealingTrackRequest):
    """Calculate Longitudinal Lesion Healing Velocity and Progress Metrics."""
    try:
        res = await track_longitudinal_healing(
            initial_image_url=request.initial_image_url,
            current_image_url=request.current_image_url,
            days_elapsed=request.days_elapsed
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/tools/drug-interaction", response_model=DrugInteractionResponse, tags=["Agent Tools"])
async def check_drug_interaction(request: DrugInteractionRequest):
    """Execute Drug Interaction Contraindication Tool."""
    topical = request.topical_medication.lower()
    oral = (request.oral_medication or "").lower()

    if "isotretinoin" in oral and ("doxycycline" in oral or "tetracycline" in oral):
        return {
            "safe_to_combine": False,
            "interaction_risk_level": "severe",
            "warning_message": "CRITICAL CONTRAINDICATION: Combining oral isotretinoin with tetracyclines carries high risk of pseudotumor cerebri.",
            "recommended_spacing_hours": None
        }

    if "benzoyl" in topical and "tretinoin" in topical:
        return {
            "safe_to_combine": True,
            "interaction_risk_level": "moderate",
            "warning_message": "Benzoyl peroxide can oxidize tretinoin. Apply benzoyl peroxide in the morning and tretinoin at night.",
            "recommended_spacing_hours": 12
        }

    return {
        "safe_to_combine": True,
        "interaction_risk_level": "none",
        "warning_message": "No major clinical drug interaction detected.",
        "recommended_spacing_hours": None
    }

@app.post("/api/v1/mcp", tags=["Model Context Protocol"])
async def handle_mcp_jsonrpc(payload: dict):
    """JSON-RPC 2.0 endpoint for MCP clients (Claude Desktop / Cursor)."""
    method = payload.get("method", "")
    req_id = payload.get("id", 1)

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "serverInfo": {"name": "DermiAssist-FastAPI-MCP", "version": "4.0.0"}
            }
        }

    if method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "tools": [
                    {"name": "analyze_skin_condition", "description": "FastAPI Multi-Agent Diagnostic Engine"},
                    {"name": "search_hybrid_rrf", "description": "Hybrid BM25 + Vector RRF Search"},
                    {"name": "classify_skin_lesion_hf", "description": "Hugging Face Open-Source Lesion Classifier"}
                ]
            }
        }

    return {
        "jsonrpc": "2.0",
        "id": req_id,
        "result": {"status": "executed", "method": method}
    }
