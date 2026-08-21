import { NextRequest, NextResponse } from 'next/server';
import { handleMCPRequest, REGISTERED_MCP_TOOLS, REGISTERED_MCP_RESOURCES } from '@/ai/mcp/server';

/**
 * MCP Server Protocol Endpoint (JSON-RPC 2.0).
 * Handles POST requests carrying JSON-RPC 2.0 payloads.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body || typeof body !== 'object' || body.jsonrpc !== '2.0') {
            return NextResponse.json(
                {
                    jsonrpc: '2.0',
                    id: body?.id || null,
                    error: { code: -32600, message: 'Invalid JSON-RPC 2.0 request' },
                },
                { status: 400 }
            );
        }

        const response = await handleMCPRequest(body);
        return NextResponse.json(response);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'MCP Endpoint Error';
        return NextResponse.json(
            {
                jsonrpc: '2.0',
                id: null,
                error: { code: -32603, message },
            },
            { status: 500 }
        );
    }
}

/**
 * GET Handler exposing MCP server metadata and available tools.
 */
export async function GET() {
    return NextResponse.json({
        server: 'DermiAssist-AI-MCP-Server',
        version: '1.0.0',
        protocolVersion: '2024-11-05',
        capabilities: {
            tools: REGISTERED_MCP_TOOLS,
            resources: REGISTERED_MCP_RESOURCES,
        },
        documentation: 'https://modelcontextprotocol.io',
    });
}
