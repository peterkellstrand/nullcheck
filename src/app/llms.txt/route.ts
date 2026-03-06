import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * GET /llms.txt
 *
 * Machine-readable index for AI agents and LLM tools.
 * Follows the llms.txt convention for agent discovery.
 * See: https://llmstxt.org
 */
export async function GET() {
  const content = `# nullcheck

> Risk-first token analysis API for DeFi. Detect honeypots, rug pulls, and scams across Ethereum, Base, and Solana before you trade.

nullcheck protects AI agents and human traders from losing money to malicious tokens. The API analyzes smart contracts, holder distribution, liquidity health, and honeypot traps, returning a 0-100 risk score with actionable breakdown.

## For AI Agents

- [OpenAPI Specification](https://nullcheck.io/api/openapi): Full API spec with agent-optimized descriptions. Every endpoint includes decision rules, thresholds, and interpretation guidance.
- [AI Plugin Manifest](https://nullcheck.io/.well-known/ai-plugin.json): Standard plugin manifest for agent discovery.
- [MCP Server](https://www.npmjs.com/package/@nullcheck/mcp-server): Model Context Protocol server with 7 tools for risk analysis, token discovery, and whale tracking. Works with Claude Code, Claude Desktop, Cursor, VS Code, Windsurf, and any MCP-compatible tool.
- [Claude Code Plugin](https://github.com/peterkellstrand/nullcheck/tree/main/nullcheck-plugin): One-install plugin bundling MCP server + screen skill + reference files.
- [TypeScript SDK](https://www.npmjs.com/package/@nullcheck/sdk): Type-safe client for all nullcheck API endpoints.

## Quick Start

Install the MCP server:
\`\`\`
claude mcp add nullcheck npx @nullcheck/mcp-server@latest
export NULLCHECK_API_KEY=nk_your_key_here
\`\`\`

Or use the API directly:
\`\`\`
curl -H "X-API-Key: nk_your_key" https://api.nullcheck.io/api/risk/solana/{address}
\`\`\`

## Core Endpoints

- POST /api/risk/{chain}/{address}: Analyze a token for honeypots, rug pulls, contract vulnerabilities, and liquidity risks. Returns score 0-100: LOW (0-14), MEDIUM (15-29), HIGH (30-49), CRITICAL (50-100). ALWAYS call this before buying an unfamiliar token.
- POST /api/risk/batch: Screen multiple tokens in one request. Efficient for portfolio audits and watchlist scans.
- GET /api/tokens: Discover trending tokens ranked by volume and activity.
- GET /api/token/{chain}/{address}: Full token profile with price, volume, liquidity, market cap, and risk score.
- GET /api/search?q={query}: Find a token by name, symbol, or contract address.
- GET /api/whale/activity/{chain}/{address}: Track large wallet buy/sell activity over 24 hours.
- GET /api/whale/holders/{chain}/{address}: Top holders with concentration percentages and tags.

## Risk Score Interpretation

- 0-14 (LOW): Generally safe. Proceed normally.
- 15-29 (MEDIUM): Some concerns. Proceed with caution.
- 30-49 (HIGH): Significant red flags. Warn user, require confirmation.
- 50-100 (CRITICAL): Likely scam or honeypot. Do NOT trade.

Sub-scores: Honeypot (0-50, highest weight), Contract (0-30), Holders (0-15), Liquidity (0-5).

## Critical Rule

If honeypot.isHoneypot == true, the token CANNOT be sold. Never execute a trade on a detected honeypot.

## Supported Chains

- ethereum: Mainnet EVM, 0x-prefixed addresses (42 chars)
- base: L2 by Coinbase, 0x-prefixed addresses (42 chars)
- solana: Base58 addresses (32-44 chars, case-sensitive)

## Authentication

All endpoints require X-API-Key header. Key format: nk_ followed by 32 characters.
Get a key at https://nullcheck.io/pricing

## Recommended Workflows

Trading bot: check_token_risk before every trade → reject CRITICAL and honeypots → proceed if LOW/MEDIUM
Portfolio audit: batch_risk_check all holdings → group by risk level → flag CRITICAL for immediate action
Token discovery: get_trending_tokens → batch_risk_check the list → filter to LOW/MEDIUM only
Whale monitoring: get_whale_activity → check net flow direction → combine with risk score for context

## Pricing

- Developer: $49/mo, 10K requests/day
- Professional: $199/mo, 100K requests/day
- Business: $999/mo, 300K requests/day
- Enterprise: Custom

## Links

- Website: https://nullcheck.io
- API Docs: https://nullcheck.io/docs
- Methodology: https://nullcheck.io/methodology
- Support: support@nullcheck.io
`;

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
