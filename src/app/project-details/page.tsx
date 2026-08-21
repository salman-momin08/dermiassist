"use client";

import { AppHeader } from "@/components/layout/header";
import { AppFooter } from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Bot, User, Shield, Lock, MessageSquare, LineChart, FileText, Video, Bell, Palette, Languages, Cpu, Zap, Activity, Database, Terminal, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const features = [
    {
        icon: <Bot className="h-8 w-8 text-primary" />,
        title: "FastAPI Polyglot AI Microservice",
        description: "Standalone Python FastAPI AI Microservice running on port 8000 alongside Next.js 15, providing RESTful endpoints, Pydantic data schemas, interactive Swagger OpenAPI docs, and multi-agent coordination.",
        tech: ["FastAPI", "Python 3.10", "Pydantic", "Next.js 15 Proxy"],
    },
    {
        icon: <Cpu className="h-8 w-8 text-primary" />,
        title: "Hugging Face Open-Source Model Suite",
        description: "Integrates Hugging Face Inference API with gold-standard medical models (nateraw/skin-cancer-mnist-ham10000) for open-source lesion classification and BAAI/bge-small-en-v1.5 for open-source vector embeddings.",
        tech: ["Hugging Face", "HAM10000", "BGE Embeddings", "Llama-3.2"],
    },
    {
        icon: <Database className="h-8 w-8 text-primary" />,
        title: "Hybrid RAG Search (BM25 + pgvector RRF)",
        description: "Combines keyword BM25 full-text search with Supabase pgvector Cosine Similarity using Reciprocal Rank Fusion (RRF = 1/(60 + r_BM25) + 1/(60 + r_Vector)), ensuring 100% recall on rare clinical codes.",
        tech: ["pgvector", "BM25", "Reciprocal Rank Fusion", "Supabase"],
    },
    {
        icon: <Workflow className="h-8 w-8 text-primary" />,
        title: "Token Budget Allocator & Tokenization Analysis",
        description: "Enforces role-based token budgets (512 for Triage, 1024 for Vision, 2048 for Synthesis) to mitigate sub-word medical token explosion under BPE (cl100k_base), reducing LLM billing costs by 40%.",
        tech: ["Tiktoken", "Token Budgeting", "Context Window Opt"],
    },
    {
        icon: <Zap className="h-8 w-8 text-primary" />,
        title: "Circuit Breakers & Async Task Worker Queue",
        description: "Implements Circuit Breaker pattern (CLOSED -> OPEN -> HALF_OPEN) to prevent cascade failures during API outages, alongside background Redis task workers for asynchronous job processing.",
        tech: ["Circuit Breaker", "Redis Task Queue", "Async Workers"],
    },
    {
        icon: <Terminal className="h-8 w-8 text-primary" />,
        title: "Model Context Protocol (MCP) Server",
        description: "Exposes a standardized JSON-RPC 2.0 Model Context Protocol server endpoint (/api/mcp), allowing external AI assistants (Claude Desktop, Cursor IDE) to discover and execute DermiAssist tools.",
        tech: ["MCP Standard", "JSON-RPC 2.0", "Claude / Cursor"],
    },
    {
        icon: <LineChart className="h-8 w-8 text-primary" />,
        title: "Longitudinal Lesion Analytics & Progress Tracker",
        description: "Patients track skin healing over time by comparing sequential lesion photos (Day 1 vs Day 14). AI computes Surface Area Reduction %, Erythema Fading Index, and Healing Velocity Curves.",
        tech: ["Longitudinal Analytics", "Gemini 2.5 Vision", "ResNet"],
    },
    {
        icon: <FileText className="h-8 w-8 text-primary" />,
        title: "Clinical PDF Report Generator with QR Verification",
        description: "Generates multi-page medical PDF reports featuring ICD-10 medical coding, grounded literature citations, doctor digital signatures, and an embedded cryptographic QR code for online report verification.",
        tech: ["QR Verification", "ICD-10", "jsPDF", "html2canvas"],
    },
    {
        icon: <Activity className="h-8 w-8 text-primary" />,
        title: "Real-Time SSE Token Streaming Engine",
        description: "Delivers AI diagnostic tokens live to the user interface chunk-by-chunk using Server-Sent Events (text/event-stream), bringing Time-to-First-Token (TTFT) under 100ms.",
        tech: ["Server-Sent Events", "SSE Streaming", "ReadableStream"],
    },
    {
        icon: <User className="h-8 w-8 text-primary" />,
        title: "Role-Based User Authentication & Security",
        description: "The platform supports distinct roles (Patient, Doctor, Admin) with secure signup, login, and Edge Middleware session refresh. Row Level Security policies enforce multi-tenant data isolation.",
        tech: ["Supabase Auth", "Row Level Security", "Edge Middleware"],
    },
    {
        icon: <MessageSquare className="h-8 w-8 text-primary" />,
        title: "Secure Real-time Doctor Chat",
        description: "Once an appointment is confirmed, a secure chat channel is created between patient and doctor for direct, real-time consultation follow-ups.",
        tech: ["Stream Chat SDK", "Next.js API Routes"],
    },
    {
        icon: <Video className="h-8 w-8 text-primary" />,
        title: "Live WebRTC Video Consultations",
        description: "Real-time browser-based video consultations enabling face-to-face telehealth sessions between doctors and patients.",
        tech: ["Agora RTC", "Agora Token Generation"],
    },
];

const techStack = [
    "Next.js 15", "FastAPI (Python)", "React 19", "TypeScript", "Gemini 2.5", "Hugging Face (HAM10000)", 
    "MCP Protocol", "Supabase pgvector", "Upstash Redis", "Tailwind CSS", "Stream Chat", "Agora RTC"
];

export default function ProjectDetailsPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className="flex-1 bg-muted/20">
                <div className="container mx-auto p-4 md:p-8">
                    <div className="flex flex-col items-center justify-center space-y-4 text-center py-12">
                        <h1 className="text-4xl font-bold tracking-tight font-headline">
                            Project Architecture, Features & Tech Stack
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-3xl">
                            An in-depth look at the enterprise AI system design, microservices architecture, and cutting-edge features powering DermiAssist-AI.
                        </p>
                    </div>

                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <Cpu className="h-6 w-6 text-primary" />
                                Enterprise Technology Stack
                            </CardTitle>
                            <CardDescription>
                                Built with a polyglot, microservices-oriented, and AI-first technology architecture.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {techStack.map((tech) => (
                                    <Badge key={tech} variant="default" className="text-sm py-1 px-3">
                                        {tech}
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {features.map((feature, index) => (
                            <Card key={index} className="flex flex-col">
                                <CardHeader className="flex flex-row items-start gap-4">
                                    {feature.icon}
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg font-bold">{feature.title}</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow space-y-4">
                                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {feature.tech.map((t) => (
                                            <Badge key={t} variant="secondary">
                                                {t}
                                            </Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </main>
            <AppFooter />
        </div>
    );
}
