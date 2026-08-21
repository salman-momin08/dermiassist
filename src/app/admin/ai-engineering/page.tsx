'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cpu, Database, Zap, Award, Activity, RefreshCw, CheckCircle2, AlertTriangle, Terminal, Code2 } from 'lucide-react';

export default function AIEngineeringDashboard() {
    const [symptomsInput, setSymptomsInput] = useState('Itchy red elevated rash on inner elbows for 3 weeks, dry skin');
    const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'openai'>('gemini');
    const [loading, setLoading] = useState(false);
    const [evalLoading, setEvalLoading] = useState(false);
    const [mcpLoading, setMcpLoading] = useState(false);
    const [pipelineResult, setPipelineResult] = useState<any>(null);
    const [evalReport, setEvalReport] = useState<any>(null);
    const [mcpResult, setMcpResult] = useState<any>(null);

    const handleRunPipeline = async (providerOverride?: 'gemini' | 'openai') => {
        const provider = providerOverride || selectedProvider;
        setLoading(true);
        setPipelineResult(null);
        try {
            const res = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symptoms: symptomsInput, provider }),
            });
            const data = await res.json();
            setPipelineResult(data);
        } catch (err) {
            console.error('Pipeline execution error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRunEvals = async () => {
        setEvalLoading(true);
        try {
            const res = await fetch('/api/ai/eval');
            const data = await res.json();
            setEvalReport(data);
        } catch (err) {
            console.error('Eval harness error:', err);
        } finally {
            setEvalLoading(false);
        }
    };

    const handleTestMCP = async (method: string, toolName?: string) => {
        setMcpLoading(true);
        try {
            let payload: any = { jsonrpc: '2.0', id: Date.now(), method };
            if (method === 'tools/call') {
                if (toolName === 'check_drug_interactions') {
                    payload.params = {
                        name: 'check_drug_interactions',
                        arguments: { topicalMedication: 'Benzoyl Peroxide', oralMedication: 'Isotretinoin' },
                    };
                } else if (toolName === 'query_doctor_availability') {
                    payload.params = {
                        name: 'query_doctor_availability',
                        arguments: { specialty: 'General Dermatology' },
                    };
                } else {
                    payload.params = {
                        name: 'search_medical_knowledge',
                        arguments: { query: 'Eczema management', categoryFilter: 'Eczema' },
                    };
                }
            }
            const res = await fetch('/api/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            setMcpResult(data);
        } catch (err) {
            console.error('MCP request error:', err);
        } finally {
            setMcpLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-8 max-w-7xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
                        <Cpu className="h-8 w-8 text-primary" />
                        AI Engineering & MCP Control Center
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Enterprise AI patterns: Multi-Agent Orchestration, Vector RAG Retrieval, MCP Protocol, Semantic Caching, Guardrails & LLM-as-a-Judge Evals.
                    </p>
                </div>
                <Badge variant="outline" className="text-xs px-3 py-1 bg-primary/10 text-primary border-primary/30">
                    Genkit + Gemini 2.5 + MCP JSON-RPC 2.0
                </Badge>
            </div>

            <Tabs defaultValue="orchestrator" className="w-full">
                <TabsList className="grid grid-cols-4 max-w-2xl mb-6">
                    <TabsTrigger value="orchestrator" className="flex items-center gap-2 text-xs md:text-sm">
                        <Zap className="h-4 w-4" /> Multi-Agent Engine
                    </TabsTrigger>
                    <TabsTrigger value="mcp" className="flex items-center gap-2 text-xs md:text-sm">
                        <Terminal className="h-4 w-4" /> MCP Protocol
                    </TabsTrigger>
                    <TabsTrigger value="evals" className="flex items-center gap-2 text-xs md:text-sm">
                        <Award className="h-4 w-4" /> Benchmark Evals
                    </TabsTrigger>
                    <TabsTrigger value="architecture" className="flex items-center gap-2 text-xs md:text-sm">
                        <Database className="h-4 w-4" /> RAG & Cache
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: MULTI-AGENT ORCHESTRATOR DEMO */}
                <TabsContent value="orchestrator" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Activity className="h-5 w-5 text-indigo-500" />
                                Interactive Multi-Agent Diagnostic Pipeline
                            </CardTitle>
                            <CardDescription>
                                Triggers parallel execution of Triage Agent, Vision Analysis, RAG Retrieval Agent, Synthesis Agent, and Safety Guardrails.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-semibold mb-2 block">Patient Symptoms Prompt</label>
                                <Textarea
                                    value={symptomsInput}
                                    onChange={(e) => setSymptomsInput(e.target.value)}
                                    rows={3}
                                    placeholder="Enter clinical symptoms..."
                                />
                            </div>

                            <div>
                                <label className="text-sm font-semibold mb-2 block">AI Reasoning Engine & Provider</label>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={selectedProvider === 'gemini' ? 'default' : 'outline'}
                                        onClick={() => setSelectedProvider('gemini')}
                                        className="text-xs"
                                    >
                                        ⚡ Google Gemini 2.5 Flash (Default)
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={selectedProvider === 'openai' ? 'default' : 'outline'}
                                        onClick={() => setSelectedProvider('openai')}
                                        className="text-xs"
                                    >
                                        🟢 OpenAI GPT-4o (Clinical Reasoning)
                                    </Button>
                                </div>
                            </div>

                            <Button onClick={() => handleRunPipeline()} disabled={loading} className="w-full md:w-auto">
                                {loading ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        Synthesizing with {selectedProvider === 'openai' ? 'OpenAI GPT-4o' : 'Google Gemini'}...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="mr-2 h-4 w-4" /> Execute Multi-Agent Pipeline ({selectedProvider === 'openai' ? 'GPT-4o' : 'Gemini'})
                                    </>
                                )}
                            </Button>

                            {pipelineResult && (
                                <div className="mt-6 space-y-6 border-t pt-6">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border">
                                            <span className="text-xs text-muted-foreground block">Pipeline Latency</span>
                                            <span className="text-2xl font-bold text-indigo-600">{pipelineResult.executionTimeMs} ms</span>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border">
                                            <span className="text-xs text-muted-foreground block">Semantic Cache</span>
                                            <Badge variant={pipelineResult.cached ? 'default' : 'secondary'} className="mt-1">
                                                {pipelineResult.cached ? 'HIT (Sub-50ms)' : 'MISS (Fresh Generation)'}
                                            </Badge>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border">
                                            <span className="text-xs text-muted-foreground block">Input Guardrail</span>
                                            <Badge variant={pipelineResult.safety?.inputSanitized ? 'destructive' : 'outline'} className="mt-1">
                                                {pipelineResult.safety?.inputSanitized ? 'PII Redacted' : 'Clean / Safe'}
                                            </Badge>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border">
                                            <span className="text-xs text-muted-foreground block">Confidence Calibration</span>
                                            <span className="text-2xl font-bold text-emerald-600">
                                                {pipelineResult.report?.confidenceScore}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Agent Execution Trace Graph */}
                                    <Card className="bg-slate-950 text-slate-100 font-mono text-xs p-4">
                                        <h4 className="text-sm font-semibold mb-3 text-emerald-400 flex items-center gap-2">
                                            <Cpu className="h-4 w-4" /> Agent Execution Step Tracing
                                        </h4>
                                        <div className="space-y-2">
                                            {pipelineResult.agentTrace?.map((step: any, idx: number) => (
                                                <div key={idx} className="flex justify-between items-center border-b border-slate-800 pb-1">
                                                    <span>[{idx + 1}] {step.agent}</span>
                                                    <span className="text-indigo-400">{step.durationMs}ms</span>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>

                                    {/* Generated Report */}
                                    <div className="bg-muted/40 p-4 rounded-lg border space-y-3">
                                        <h4 className="font-bold text-lg text-primary">{pipelineResult.report?.primaryConditionName}</h4>
                                        <p className="text-sm">{pipelineResult.report?.summary}</p>
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {pipelineResult.report?.citationsUsed?.map((cit: string, i: number) => (
                                                <Badge key={i} variant="outline" className="text-xs bg-background">
                                                    📚 {cit}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 2: MODEL CONTEXT PROTOCOL (MCP) INTERFACE */}
                <TabsContent value="mcp" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Terminal className="h-5 w-5 text-purple-500" />
                                Model Context Protocol (MCP) Server Interface
                            </CardTitle>
                            <CardDescription>
                                Standardized JSON-RPC 2.0 interface exposing diagnostic tools, vector knowledge retrieval, and clinical guidelines to external AI assistants (Claude, Cursor, Continue.dev).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-wrap gap-3">
                                <Button onClick={() => handleTestMCP('initialize')} disabled={mcpLoading} variant="outline">
                                    Initialize Server
                                </Button>
                                <Button onClick={() => handleTestMCP('tools/list')} disabled={mcpLoading} variant="outline">
                                    List Tools (`tools/list`)
                                </Button>
                                <Button onClick={() => handleTestMCP('resources/list')} disabled={mcpLoading} variant="outline">
                                    List Resources (`resources/list`)
                                </Button>
                                <Button onClick={() => handleTestMCP('tools/call', 'search_medical_knowledge')} disabled={mcpLoading} className="bg-purple-600 hover:bg-purple-700 text-white">
                                    Call `search_medical_knowledge` Tool
                                </Button>
                                <Button onClick={() => handleTestMCP('tools/call', 'check_drug_interactions')} disabled={mcpLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                    Call `check_drug_interactions` Tool
                                </Button>
                                <Button onClick={() => handleTestMCP('tools/call', 'query_doctor_availability')} disabled={mcpLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                    Call `query_doctor_availability` Tool
                                </Button>
                            </div>

                            {mcpResult && (
                                <div className="mt-4">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                                        <Code2 className="h-4 w-4" /> JSON-RPC 2.0 Response Payload
                                    </h4>
                                    <Card className="bg-slate-950 text-slate-100 font-mono text-xs p-4 overflow-x-auto max-h-96">
                                        <pre>{JSON.stringify(mcpResult, null, 2)}</pre>
                                    </Card>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 3: BENCHMARK EVALS */}
                <TabsContent value="evals" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Award className="h-5 w-5 text-amber-500" />
                                LLM-as-a-Judge Evaluation & Benchmarking Suite
                            </CardTitle>
                            <CardDescription>
                                Automated benchmarking harness evaluating diagnostic accuracy, RAG faithfulness, and safety compliance across standardized clinical cases.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button onClick={handleRunEvals} disabled={evalLoading}>
                                {evalLoading ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Running Evaluation Harness...
                                    </>
                                ) : (
                                    <>
                                        <Award className="mr-2 h-4 w-4" /> Run Benchmark Evals Suite
                                    </>
                                )}
                            </Button>

                            {evalReport && (
                                <div className="space-y-6 mt-6 border-t pt-6">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-lg border border-emerald-200">
                                            <span className="text-xs text-muted-foreground block">Diagnostic Accuracy</span>
                                            <span className="text-3xl font-extrabold text-emerald-600">
                                                {evalReport.accuracyPercentage}%
                                            </span>
                                        </div>
                                        <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-lg border border-blue-200">
                                            <span className="text-xs text-muted-foreground block">Citation Coverage</span>
                                            <span className="text-3xl font-extrabold text-blue-600">
                                                {evalReport.citationCoveragePercentage}%
                                            </span>
                                        </div>
                                        <div className="bg-indigo-50 dark:bg-indigo-950/40 p-4 rounded-lg border border-indigo-200">
                                            <span className="text-xs text-muted-foreground block">Safety Compliance</span>
                                            <span className="text-3xl font-extrabold text-indigo-600">
                                                {evalReport.disclaimerCompliancePercentage}%
                                            </span>
                                        </div>
                                        <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-lg border border-amber-200">
                                            <span className="text-xs text-muted-foreground block">Average Latency</span>
                                            <span className="text-3xl font-extrabold text-amber-600">
                                                {evalReport.avgLatencyMs}ms
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="font-semibold text-sm">Individual Benchmark Case Results</h4>
                                        <div className="space-y-2">
                                            {evalReport.results?.map((item: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between p-3 border rounded-md bg-background text-sm">
                                                    <div className="flex items-center gap-3">
                                                        {item.passed ? (
                                                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                                        ) : (
                                                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                                                        )}
                                                        <div>
                                                            <span className="font-medium block">{item.caseTitle}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                Expected: {item.expectedCondition} | Evaluated: {item.evaluatedCondition}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline">{item.executionTimeMs}ms</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 4: ARCHITECTURE & RAG DETAILS */}
                <TabsContent value="architecture" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Database className="h-5 w-5 text-indigo-500" />
                                Medical RAG & Semantic Cache Architecture
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-muted-foreground">
                            <p>
                                <strong>Vector Indexing:</strong> PostgreSQL `pgvector` index with 768-dimensional embeddings (`text-embedding-004`).
                            </p>
                            <p>
                                <strong>Hybrid RRF Reranking:</strong> BM25 keyword matching combined with dense vector similarity via Reciprocal Rank Fusion (RRF = 1/(60 + rank_BM25) + 1/(60 + rank_Vector)).
                            </p>
                            <p>
                                <strong>Semantic Cache:</strong> Cosine similarity matching threshold ($&gt;0.92$) bypassing LLM calls for recurring queries, achieving sub-50ms execution speed.
                            </p>
                            <p>
                                <strong>Hugging Face Integration:</strong> Open-Source HAM10000 skin lesion classifier (`nateraw/skin-cancer-mnist-ham10000`) and BGE embeddings (`BAAI/bge-small-en-v1.5`).
                            </p>
                            <p>
                                <strong>Model Context Protocol (MCP):</strong> Native JSON-RPC 2.0 server interface allowing any MCP-compliant client to consume DermiAssist tools over standard endpoints (`/api/mcp`).
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
