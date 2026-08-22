# 🏛 DermiAssist-AI: Comprehensive System Architecture & Schema Specification

**DermiAssist-AI** is an enterprise-grade medical AI platform designed as a **polyglot microservices architecture**. It couples a modern edge-rendered **Next.js 15** frontend with a high-throughput **Python FastAPI & LangGraph Multi-Agent** inference engine.

---

## 1. High-Level System Architecture Topology

The following diagram illustrates the end-to-end component layers, network boundaries, and real-time telehealth infrastructure:

![System Architecture Topology](docs/diagrams/system_topology.svg)

<details>
<summary><b>View Raw Mermaid Code</b></summary>

```mermaid
graph TB
    subgraph Client Layer [1. Client & Presentation Layer]
        WEB[Next.js 15 Web App<br/>React 19 / Tailwind / Radix]
        MOBILE[Mobile Viewports<br/>PWA & Touch Responsive]
        MCP_CLIENT[External MCP Clients<br/>Claude Desktop / Cursor]
    end

    subgraph Edge Layer [2. Edge Security & Session Gateway]
        MW[Edge Middleware<br/>src/middleware.ts]
        AUTH_GATE[Supabase SSR Session Auth]
        RATE_LIMIT[Upstash Redis Rate Limiter<br/>Sliding Window 20 req/min]
    end

    subgraph App Layer [3. Application & Microservices Layer]
        NEXT_API[Next.js API & Server Actions<br/>/src/app/api/* & Genkit Flows]
        MCP_SERVER[MCP Protocol Server<br/>/api/mcp JSON-RPC 2.0]
        FASTAPI[Python FastAPI AI Microservice<br/>/ai_service (Port 8000)]
    end

    subgraph LangGraph Layer [4. Multi-Agent AI Engine & LangGraph State Machine]
        LG_ENGINE[LangGraph State Machine<br/>DermatologyDiagnosticState]
        VISION_AGENT[Vision Diagnostic Agent<br/>Gemini 2.5 Flash / GPT-4o Vision]
        PROFORMA_AGENT[Dynamic Proforma Agent<br/>Contextual Question Branching]
        SYNTHESIS_AGENT[Differential Synthesis Agent<br/>ICD-10 & Treatment Pathways]
        HF_AGENT[Hugging Face Open-Source Agent<br/>HAM10000 Skin Lesion Classifier]
        RAG_ENGINE[Hybrid RAG Engine<br/>Dense pgvector + Sparse BM25 RRF]
    end

    subgraph Data Layer [5. Data & Storage Layer]
        SUPABASE_DB[(Supabase PostgreSQL<br/>Row Level Security & Partitions)]
        PGVECTOR[(pgvector Extension<br/>768-dim Clinical Embeddings)]
        CLOUDINARY[Cloudinary Media CDN<br/>Encrypted Image Storage]
    end

    subgraph Telehealth Layer [6. Real-Time Telehealth Infrastructure]
        STREAM_CHAT[Stream Chat Infrastructure<br/>Doctor-Patient Secure Messaging]
        AGORA_RTC[Agora WebRTC Network<br/>Low-Latency HD Video Consultations]
    end

    %% Flow connections
    WEB --> MW
    MOBILE --> MW
    MCP_CLIENT --> MCP_SERVER
    MW --> AUTH_GATE
    MW --> RATE_LIMIT
    MW --> NEXT_API

    NEXT_API <--> FASTAPI
    MCP_SERVER <--> FASTAPI
    FASTAPI --> LG_ENGINE
    
    LG_ENGINE --> VISION_AGENT
    LG_ENGINE --> PROFORMA_AGENT
    LG_ENGINE --> SYNTHESIS_AGENT
    LG_ENGINE --> HF_AGENT
    LG_ENGINE --> RAG_ENGINE

    NEXT_API <--> SUPABASE_DB
    FASTAPI <--> SUPABASE_DB
    RAG_ENGINE <--> PGVECTOR
    NEXT_API --> CLOUDINARY
    NEXT_API --> STREAM_CHAT
    NEXT_API --> AGORA_RTC
```
</details>

---

## 2. LangGraph Multi-Agent Clinical Diagnostic Flowchart

The AI diagnostic triage pipeline is modeled as a stateful, cyclical **LangGraph** multi-agent graph:

![LangGraph Diagnostic Flowchart](docs/diagrams/langgraph_flowchart.svg)

<details>
<summary><b>View Raw Mermaid Code</b></summary>

```mermaid
flowchart TD
    START([Patient Uploads Lesion Specimen]) --> COMPRESS[Client-Side HTML5 Canvas Optimization<br/>1024px Max / 0.85 Quality JPEG]
    COMPRESS --> STATE_INIT[Initialize DermatologyDiagnosticState<br/>photo_data_uri, turn_count=0]

    STATE_INIT --> NODE_VISION[Node 1: Multimodal Vision Diagnostic Agent]
    NODE_VISION --> DECIDE_DIFF{Primary Differential<br/>Identified?}

    DECIDE_DIFF -- Yes --> NODE_PROFORMA[Node 2: Dynamic Proforma Question Agent]
    DECIDE_DIFF -- Uncertain / Ambiguous --> NODE_HF_FALLBACK[Hugging Face HAM10000<br/>Ensemble Vision Model]
    NODE_HF_FALLBACK --> NODE_PROFORMA

    NODE_PROFORMA --> ASK_USER[Synthesize Single Contextual Follow-Up Question<br/>Investigate Timeline, Sensation, Triggers]
    ASK_USER --> USER_REPLY[/Patient Submits Clinical Answer/]
    USER_REPLY --> UPDATE_STATE[Update Conversation Transcript<br/>turn_count = turn_count + 1]

    UPDATE_STATE --> EVAL_CHECK{Turn Count >= 5 or<br/>Sufficient Diagnostic Context?}
    EVAL_CHECK -- Need More Context --> NODE_PROFORMA
    EVAL_CHECK -- Yes, Proceed --> NODE_SYNTHESIS[Node 3: Clinical Synthesis & Differential Agent]

    NODE_SYNTHESIS --> RAG_GROUNDING[Node 4: Hybrid RAG & Grounding Retrieval<br/>ICD-10 Codes, Contraindications, Do's & Don'ts]
    RAG_GROUNDING --> NODE_SAFETY[Node 5: Medical Guardrail & Disclaimer Validation]
    NODE_SAFETY --> FINAL_REPORT([Generate Comprehensive Medical Assessment Report<br/>Interactive UI & Downloadable Medical PDF])
```
</details>

---

## 3. Database Entity Relationship Diagram (ERD)

The persistent database schema is structured on **Supabase PostgreSQL** with Row-Level Security (RLS) policies and pgvector embedding extensions:

![Database Entity Relationship Diagram](docs/diagrams/database_erd.svg)

<details>
<summary><b>View Raw Mermaid Code</b></summary>

```mermaid
erDiagram
    USERS ||--o| PROFILES : "has"
    PROFILES ||--o{ ANALYSES : "conducts"
    PROFILES ||--o{ APPOINTMENTS : "books"
    DOCTORS ||--o{ APPOINTMENTS : "attends"
    DOCTORS ||--o{ DOCTOR_REVIEWS : "receives"
    PROFILES ||--o{ DOCTOR_REVIEWS : "writes"
    PROFILES ||--o{ MY_REQUESTS : "submits"
    KNOWLEDGE_BASE ||--o{ KNOWLEDGE_CHUNKS : "contains"

    USERS {
        uuid id PK
        string email
        string encrypted_password
        timestamp created_at
    }

    PROFILES {
        uuid id PK, FK
        string full_name
        string role "patient | doctor | admin"
        string avatar_url
        string phone_number
        jsonb medical_history
        timestamp updated_at
    }

    ANALYSES {
        uuid id PK
        uuid user_id FK
        string image_url
        string detected_condition
        string icd_10_code
        float confidence_score
        string severity "Mild | Moderate | Severe"
        jsonb dos
        jsonb donts
        text recommendations
        text other_considerations
        jsonb conversation_transcript
        timestamp created_at
    }

    APPOINTMENTS {
        uuid id PK
        uuid patient_id FK
        uuid doctor_id FK
        timestamp appointment_date
        string appointment_mode "Video Call | In-Person"
        string status "Pending | Confirmed | Completed | Declined"
        string meeting_room_id
        text patient_notes
        text doctor_prescription
        timestamp created_at
    }

    DOCTORS {
        uuid id PK
        uuid user_id FK
        string specialization
        string license_number
        int years_of_experience
        string clinic_address
        float consultation_fee
        boolean is_verified
        jsonb available_slots
    }

    DOCTOR_REVIEWS {
        uuid id PK
        uuid doctor_id FK
        uuid patient_id FK
        int rating "1 - 5"
        text review_text
        timestamp created_at
    }

    MY_REQUESTS {
        uuid id PK
        uuid user_id FK
        string request_type "Doctor Verification | Report Re-evaluation | Admin Support"
        string status "Open | In Review | Resolved | Rejected"
        jsonb payload
        timestamp created_at
    }

    KNOWLEDGE_CHUNKS {
        uuid id PK
        string title
        string condition_category
        text content
        string icd_code
        vector_768 embedding "pgvector Clinical Embedding"
        string source_citation
    }
```
</details>

---

## 4. End-to-End Diagnostic Request Lifecycle

Sequence diagram illustrating the interaction between the patient, Next.js client, Edge proxy, Python LangGraph engine, and database:

![End-to-End Diagnostic Sequence Diagram](docs/diagrams/diagnostic_sequence.svg)

<details>
<summary><b>View Raw Mermaid Code</b></summary>

```mermaid
sequenceDiagram
    autonumber
    actor Patient as Patient User
    participant UI as Next.js Client App
    participant NextServer as Next.js Server Action / API
    participant LangGraph as Python FastAPI (LangGraph Engine)
    participant Gemini as Google Gemini 2.5 Flash
    participant DB as Supabase PostgreSQL + pgvector
    participant Cloudinary as Cloudinary CDN

    Patient->>UI: Selects & uploads skin lesion photo
    UI->>UI: Client-Side Canvas Compression (<250KB JPEG)
    UI->>NextServer: POST /api/ai/analyze (photoDataUri)
    NextServer->>LangGraph: POST /api/v1/langgraph/detect
    LangGraph->>Gemini: Vision Multimodal Analysis
    Gemini-->>LangGraph: Primary Differential (e.g. "Psoriasis")
    LangGraph-->>NextServer: { condition_name: "Psoriasis" }
    NextServer-->>UI: Display Condition & Initiate Proforma

    loop Dynamic Clinical Proforma Inquiry (Up to 5 Turns)
        UI->>NextServer: Request next clinical follow-up question
        NextServer->>LangGraph: POST /api/v1/langgraph/next-question (History & Condition)
        LangGraph->>Gemini: Contextual Question Generation
        Gemini-->>LangGraph: Dynamic Clinical Question
        LangGraph-->>NextServer: { next_question: "..." }
        NextServer-->>UI: Render message bubble in chat
        Patient->>UI: Types or dictates voice symptom reply
    end

    Patient->>UI: Clicks "Complete Assessment"
    UI->>NextServer: POST /api/ai/eval (Full History + Photo)
    NextServer->>LangGraph: POST /api/v1/langgraph/evaluate
    LangGraph->>DB: Search pgvector Hybrid RAG for clinical guidelines
    DB-->>LangGraph: Matched Treatment Chunks & ICD-10 Coding
    LangGraph->>Gemini: Generate Final Synthesis Report
    Gemini-->>LangGraph: JSON Medical Assessment
    LangGraph-->>NextServer: Structured Clinical Report
    NextServer->>Cloudinary: Store verified specimen
    NextServer->>DB: INSERT INTO analyses (Report, Transcripts, ICD-10)
    NextServer-->>UI: Return Full Report Object
    UI->>Patient: Render Clinical View & Enable PDF Export
```
</details>

---

## 5. Telehealth Real-Time Consultation Architecture

Sequence diagram demonstrating the WebRTC video consultation and real-time chat lifecycle:

![Real-Time Telehealth Consultation Architecture](docs/diagrams/telehealth_sequence.svg)

<details>
<summary><b>View Raw Mermaid Code</b></summary>

```mermaid
sequenceDiagram
    autonumber
    actor Patient as Patient
    actor Doctor as Dermatologist
    participant WebApp as DermiAssist Web Client
    participant API as Telehealth Session API
    participant Agora as Agora RTC Engine
    participant Stream as Stream Chat Network

    Doctor->>WebApp: Accept appointment & generate room
    WebApp->>API: POST /api/connections (create room)
    API->>Agora: Generate Agora RTC Token (channel: roomId)
    API->>Stream: Provision Stream Chat Channel
    API-->>WebApp: { roomId, agoraToken, streamChannelId }

    Patient->>WebApp: Join consultation from Dashboard
    WebApp->>API: GET /api/stream-token (Auth verified)
    API-->>WebApp: Return user RTC & Stream credentials

    par Parallel Real-Time Channels
        WebApp->>Agora: Initialize WebRTC Media Stream (Audio/Video Track)
        Agora-->>WebApp: Peer-to-peer encrypted audio/video connection
    and
        WebApp->>Stream: Connect Stream Chat WebSocket
        Stream-->>WebApp: Real-time clinical text & prescription attachments
    end

    Doctor->>WebApp: Issue digital clinical prescription & notes
    WebApp->>API: PATCH /api/appointments/{id} (status: Completed)
    API->>WebApp: Save record to patient consultation history
```
</details>

---

## 6. Distributed Security, Guardrails & Reliability Topology

![Distributed Security & Reliability Topology](docs/diagrams/security_topology.svg)

<details>
<summary><b>View Raw Mermaid Code</b></summary>

```mermaid
graph LR
    subgraph Ingestion & Edge
        REQ[Incoming Patient Request] --> SANITIZE[PII Input Redactor<br/>Strip SSN, Card Numbers]
        SANITIZE --> RATELIMIT[Upstash Redis Limiter<br/>Sliding Window: 20 req/min]
    end

    subgraph Fault-Tolerant Execution
        RATELIMIT --> CB{Circuit Breaker<br/>Closed?}
        CB -- Yes --> DISPATCH[Python LangGraph Microservice]
        CB -- Tripped (Open) --> FALLBACK[TypeScript Genkit Flow<br/>Direct Model Fallback]
        DISPATCH --> TOKEN_BUDGET[Token Budgeting & Truncation<br/>Max 8192 Tokens / Request]
    end

    subgraph Output Validation
        TOKEN_BUDGET --> VALIDATE[JSON Schema Validation<br/>Zod / Pydantic Verification]
        FALLBACK --> VALIDATE
        VALIDATE --> DISCLAIMER[Disclaimer Injection & Medical Safety Guardrail]
        DISCLAIMER --> CLIENT[Secure Client Delivery]
    end
```
</details>


---

## 7. Technology Stack Reference Matrix

| Layer | Technologies & Frameworks | Purpose & Responsibility |
| :--- | :--- | :--- |
| **Frontend UI/UX** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons, Radix UI | Responsive patient dashboard, dynamic proforma chat, doctor portal, real-time charts |
| **Microservices Backend** | Python 3.12, FastAPI, Uvicorn, Pydantic v2 | High-throughput AI microservice, REST API endpoints, OpenAPI documentation |
| **Multi-Agent AI Engine** | LangGraph, LangChain, Google GenAI SDK (Gemini 2.5 Flash), OpenAI GPT-4o | Stateful clinical graphs, vision diagnostic agents, proforma question branching, clinical synthesis |
| **Open-Source ML** | Hugging Face Transformers, HAM10000 Dataset, BAAI/bge-small-en-v1.5 | Open-source skin lesion classification and dense medical embeddings |
| **Database & Vector RAG**| Supabase PostgreSQL, `pgvector`, Row Level Security (RLS) | Relational case history, patient records, 768-dimensional clinical knowledge search |
| **Caching & Rate Limiting**| Upstash Redis, Python in-memory circuit breakers | Sliding-window DDoS mitigation, LLM cost budgeting, failover routing |
| **Real-Time Telehealth** | Agora RTC SDK (WebRTC), Stream Chat React SDK | Low-latency encrypted video consultations and doctor-patient messaging |
| **Reporting & Export** | jsPDF, html2canvas, Canvas Image Compression | Client-side HIPAA-compliant PDF assessment report generation |
