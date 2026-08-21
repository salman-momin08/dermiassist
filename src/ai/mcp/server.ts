/**
 * @fileOverview Model Context Protocol (MCP) Server Implementation.
 * Exposes DermiAssist-AI tools, resources, and diagnostic capabilities
 * over standardized JSON-RPC 2.0 protocol for MCP client integrations.
 */

import { executeMultiAgentPipeline } from '@/ai/orchestrator';
import { retrieveMedicalContext } from '@/ai/rag/retriever';
import { runAIEvalHarness } from '@/ai/eval/eval-harness';
import { logger } from '@/lib/logger';

// ── MCP Protocol Specifications (JSON-RPC 2.0) ─────────────────

export interface JSONRPCRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: Record<string, unknown>;
}

export interface JSONRPCResponse {
    jsonrpc: '2.0';
    id: string | number;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}

export interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}

export interface MCPResource {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
}

// ── Defined MCP Tools & Resources ──────────────────────────────

export const REGISTERED_MCP_TOOLS: MCPTool[] = [
    {
        name: 'analyze_skin_condition',
        description: 'Triggers the Multi-Agent AI Diagnostic Pipeline (Triage, Vision Analysis, RAG Retrieval, and Differential Synthesis) for patient symptoms.',
        inputSchema: {
            type: 'object',
            properties: {
                symptoms: { type: 'string', description: 'Detailed patient skin symptoms, duration, and onset.' },
                imageUrl: { type: 'string', description: 'Optional photo URL of the skin lesion.' },
                bodyLocation: { type: 'string', description: 'Body location (e.g. face, arm, back).' },
            },
            required: ['symptoms'],
        },
    },
    {
        name: 'search_medical_knowledge',
        description: 'Executes Vector RAG similarity search against peer-reviewed dermatological guidelines and ICD-10 medical literature.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Dermatological query or disease category to search.' },
                categoryFilter: { type: 'string', description: 'Optional condition category filter (Acne, Eczema, Psoriasis, Fungal, Melanoma).' },
            },
            required: ['query'],
        },
    },
    {
        name: 'run_ai_evals',
        description: 'Executes the automated LLM-as-a-Judge evaluation benchmark harness across clinical dermatology test cases.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
];

export const REGISTERED_MCP_RESOURCES: MCPResource[] = [
    {
        uri: 'medical://guidelines/acne',
        name: 'Acne Vulgaris Clinical Guidelines 2024',
        description: 'AAD clinical practice guidelines for topical and systemic acne management.',
        mimeType: 'text/markdown',
    },
    {
        uri: 'medical://guidelines/eczema',
        name: 'Atopic Dermatitis Management Protocol',
        description: 'Journal of Investigative Dermatology protocol for eczema care.',
        mimeType: 'text/markdown',
    },
    {
        uri: 'medical://guidelines/psoriasis',
        name: 'Psoriasis Vulgaris Diagnostic Framework',
        description: 'National Psoriasis Foundation clinical practice guidelines.',
        mimeType: 'text/markdown',
    },
];

/**
 * Handle incoming MCP JSON-RPC 2.0 requests.
 */
export async function handleMCPRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const { id, method, params } = request;

    logger.info('mcp.request.received', { method, id });

    try {
        switch (method) {
            case 'initialize':
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        protocolVersion: '2024-11-05',
                        capabilities: {
                            tools: {},
                            resources: {},
                        },
                        serverInfo: {
                            name: 'DermiAssist-AI-MCP-Server',
                            version: '1.0.0',
                        },
                    },
                };

            case 'tools/list':
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        tools: REGISTERED_MCP_TOOLS,
                    },
                };

            case 'tools/call': {
                const toolName = params?.name as string;
                const toolArgs = (params?.arguments || {}) as Record<string, unknown>;

                if (toolName === 'analyze_skin_condition') {
                    const symptoms = String(toolArgs.symptoms || '');
                    const imageUrl = toolArgs.imageUrl ? String(toolArgs.imageUrl) : undefined;
                    const bodyLocation = toolArgs.bodyLocation ? String(toolArgs.bodyLocation) : undefined;

                    const pipelineResult = await executeMultiAgentPipeline({
                        symptoms,
                        imageUrl,
                        bodyLocation,
                    });

                    return {
                        jsonrpc: '2.0',
                        id,
                        result: {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(pipelineResult, null, 2),
                                },
                            ],
                        },
                    };
                }

                if (toolName === 'search_medical_knowledge') {
                    const query = String(toolArgs.query || '');
                    const categoryFilter = toolArgs.categoryFilter ? String(toolArgs.categoryFilter) : undefined;

                    const ragResult = await retrieveMedicalContext({ query, categoryFilter });

                    return {
                        jsonrpc: '2.0',
                        id,
                        result: {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(ragResult, null, 2),
                                },
                            ],
                        },
                    };
                }

                if (toolName === 'run_ai_evals') {
                    const evalReport = await runAIEvalHarness();
                    return {
                        jsonrpc: '2.0',
                        id,
                        result: {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(evalReport, null, 2),
                                },
                            ],
                        },
                    };
                }

                return {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32601,
                        message: `Tool not found: ${toolName}`,
                    },
                };
            }

            case 'resources/list':
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        resources: REGISTERED_MCP_RESOURCES,
                    },
                };

            case 'resources/read': {
                const uri = params?.uri as string;
                if (uri?.startsWith('medical://guidelines/')) {
                    const category = uri.replace('medical://guidelines/', '');
                    const ragResult = await retrieveMedicalContext({ query: category, matchCount: 2 });

                    return {
                        jsonrpc: '2.0',
                        id,
                        result: {
                            contents: [
                                {
                                    uri,
                                    mimeType: 'text/markdown',
                                    text: ragResult.groundingPromptText,
                                },
                            ],
                        },
                    };
                }

                return {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32602,
                        message: `Resource not found: ${uri}`,
                    },
                };
            }

            default:
                return {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32601,
                        message: `Method not found: ${method}`,
                    },
                };
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('mcp.request.error', { method, error: message });
        return {
            jsonrpc: '2.0',
            id,
            error: {
                code: -32603,
                message: `Internal MCP Error: ${message}`,
            },
        };
    }
}
