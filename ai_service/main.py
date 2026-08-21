"""
DermiAssist-AI FastAPI Python Microservice Application.
Provides RESTful AI endpoints, RAG search, Tool Execution, and MCP Server.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ai_service.schemas import (
    AnalysisRequest, AnalysisResponse,
    RAGQueryRequest, RAGQueryResponse,
    DrugInteractionRequest, DrugInteractionResponse,
    DoctorQueryRequest, DoctorQueryResponse
)
from ai_service.services.rag_service import search_vector_rag
from ai_service.services.orchestrator_service import run_multi_agent_pipeline

app = FastAPI(
    title="DermiAssist-AI Python Microservice",
    description="Enterprise AI Engineering Microservice providing Multi-Agent Orchestration, Vector RAG Retrieval, MCP Protocol, and Agent Tools.",
    version="2.0.0",
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
        "version": "2.0.0",
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

@app.post("/api/v1/rag/search", response_model=RAGQueryResponse, tags=["Vector RAG Engine"])
async def search_rag(request: RAGQueryRequest):
    """Execute hybrid vector cosine distance search against Supabase pgvector."""
    try:
        res = await search_vector_rag(
            query=request.query,
            category_filter=request.category_filter,
            match_count=request.match_count
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
                "serverInfo": {"name": "DermiAssist-FastAPI-MCP", "version": "2.0.0"}
            }
        }

    if method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "tools": [
                    {"name": "analyze_skin_condition", "description": "FastAPI Multi-Agent Diagnostic Engine"},
                    {"name": "search_medical_knowledge", "description": "Supabase pgvector Hybrid Search"}
                ]
            }
        }

    return {
        "jsonrpc": "2.0",
        "id": req_id,
        "result": {"status": "executed", "method": method}
    }
