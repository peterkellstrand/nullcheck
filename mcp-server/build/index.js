#!/usr/bin/env node
/**
 * nullcheck MCP Server
 *
 * Exposes the nullcheck DeFi risk analysis API as MCP tools
 * for Claude, Cursor, and other MCP-compatible AI agents.
 *
 * Usage:
 *   NULLCHECK_API_KEY=nk_... npx @nullcheck/mcp-server
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { NullcheckClient, NullcheckApiError } from './utils/client.js';
// Tools
import { checkTokenRiskTool, handleCheckTokenRisk } from './tools/check-token-risk.js';
import { getTrendingTokensTool, handleGetTrendingTokens } from './tools/get-trending-tokens.js';
import { searchTokensTool, handleSearchTokens } from './tools/search-tokens.js';
import { getWhaleActivityTool, handleGetWhaleActivity } from './tools/get-whale-activity.js';
import { getWhaleHoldersTool, handleGetWhaleHolders } from './tools/get-whale-holders.js';
import { batchRiskCheckTool, handleBatchRiskCheck } from './tools/batch-risk-check.js';
import { getTokenDetailsTool, handleGetTokenDetails } from './tools/get-token-details.js';
// ── Configuration ──────────────────────────────────────────
const API_KEY = process.env.NULLCHECK_API_KEY;
const BASE_URL = process.env.NULLCHECK_API_BASE_URL; // optional override
if (!API_KEY) {
    console.error('Error: NULLCHECK_API_KEY environment variable is required.\n' +
        'Get your API key at https://nullcheck.io/pricing\n' +
        'Then set it: export NULLCHECK_API_KEY=nk_your_key_here');
    process.exit(1);
}
const client = new NullcheckClient(API_KEY, BASE_URL);
// ── Server Setup ───────────────────────────────────────────
const server = new Server({
    name: 'nullcheck',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// ── Tool Registration ──────────────────────────────────────
const ALL_TOOLS = [
    checkTokenRiskTool,
    getTrendingTokensTool,
    searchTokensTool,
    getWhaleActivityTool,
    getWhaleHoldersTool,
    batchRiskCheckTool,
    getTokenDetailsTool,
];
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ALL_TOOLS,
}));
// ── Tool Execution ─────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case 'check_token_risk':
                return await handleCheckTokenRisk(client, args);
            case 'get_trending_tokens':
                return await handleGetTrendingTokens(client, args);
            case 'search_tokens':
                return await handleSearchTokens(client, args);
            case 'get_whale_activity':
                return await handleGetWhaleActivity(client, args);
            case 'get_whale_holders':
                return await handleGetWhaleHolders(client, args);
            case 'batch_risk_check':
                return await handleBatchRiskCheck(client, args);
            case 'get_token_details':
                return await handleGetTokenDetails(client, args);
            default:
                return {
                    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
                    isError: true,
                };
        }
    }
    catch (error) {
        if (error instanceof NullcheckApiError) {
            return error.toToolResult();
        }
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: 'text', text: `Unexpected error: ${message}` }],
            isError: true,
        };
    }
});
// ── Start ──────────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('nullcheck MCP server running');
}
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map