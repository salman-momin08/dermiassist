import { NextRequest, NextResponse } from 'next/server';
import { handleMCPRequest, REGISTERED_MCP_TOOLS, REGISTERED_MCP_RESOURCES } from '@/ai/mcp/server';
import { checkRateLimit, RateLimitPresets } from '@/lib/redis/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const maxDuration = 300;

// Tool names that invoke the full multi-agent pipeline (or run it repeatedly
// across benchmark cases) — everything else on this JSON-RPC endpoint
// (initialize, tools/list, resources/*, etc.) is cheap protocol negotiation
// and shouldn't be throttled the same way.
const EXPENSIVE_MCP_TOOLS = new Set(['analyze_skin_condition', 'run_ai_evals']);

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

        let userId: string | undefined;
        if (body.method === 'tools/call') {
            const supabase = await createClient();
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                return NextResponse.json({ jsonrpc: '2.0', id: body.id ?? null, error: { code: -32001, message: 'Authentication required' } }, { status: 401 });
            }
            userId = user.id;
            if (body.params?.name === 'run_ai_evals') {
                const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', user.id).single();
                if (error || profile?.role !== 'admin') {
                    return NextResponse.json({ jsonrpc: '2.0', id: body.id ?? null, error: { code: -32001, message: 'Administrator access required' } }, { status: 403 });
                }
            }
        }
        if (body.method === 'tools/call' && EXPENSIVE_MCP_TOOLS.has(body.params?.name)) {
            const identifier = userId!;
            const rateLimitResult = await checkRateLimit({
                limit: RateLimitPresets.AI_ANALYSIS.limit,
                window: RateLimitPresets.AI_ANALYSIS.window,
                identifier,
                endpoint: `/api/mcp:${body.params.name}`,
            });
            if (!rateLimitResult.success) {
                return NextResponse.json(
                    {
                        jsonrpc: '2.0',
                        id: body.id ?? null,
                        error: { code: -32000, message: rateLimitResult.unavailable ? 'Request protection is temporarily unavailable.' : 'Rate limit exceeded. Please try again later.' },
                    },
                    { status: rateLimitResult.unavailable ? 503 : 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter ?? 3600) } }
                );
            }
        }

        const response = await handleMCPRequest(body);
        return NextResponse.json(response);
    } catch (err: unknown) {
        logger.error('mcp.request.failed', { error: String(err) });
        const message = err instanceof SyntaxError ? 'Invalid JSON request' : 'MCP Endpoint Error';
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
    return NextResponse.json(
        {
            server: 'DermiAssist-AI-MCP-Server',
            version: '1.0.0',
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: REGISTERED_MCP_TOOLS,
                resources: REGISTERED_MCP_RESOURCES,
            },
            documentation: 'https://modelcontextprotocol.io',
        },
        {
            // This metadata is static per-deploy — safe to cache for an hour
            // instead of recomputing on every call.
            headers: { 'Cache-Control': 'public, max-age=3600' },
        }
    );
}
