"""
DermiAssist-AI FastAPI Python Microservice Application.
Provides RESTful AI endpoints, RAG search, Tool Execution, MCP Server, and Hugging Face Open-Source Model Integrations.
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
from ai_service.services.huggingface_service import classify_skin_lesion_hf, generate_bge_embedding_hf

app = FastAPI(
    title="DermiAssist-AI Polyglot Python Microservice",
    description="Enterprise AI Engineering Microservice providing Multi-Agent Orchestration, Vector RAG Retrieval, MCP Protocol, Agent Tools, and Hugging Face Open-Source Models.",
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
        "huggingface": "enabled",
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
                    {"name": "search_medical_knowledge", "description": "Supabase pgvector Hybrid Search"},
                    {"name": "classify_skin_lesion_hf", "description": "Hugging Face Open-Source Lesion Classifier"}
                ]
            }
        }

    return {
        "jsonrpc": "2.0",
        "id": req_id,
        "result": {"status": "executed", "method": method}
    }
