# @nullcheck/mcp-server

MCP server for [nullcheck](https://nullcheck.io) — DeFi token risk analysis for AI agents.

Detect honeypots, rug pulls, and scams across Ethereum, Base, and Solana before you trade.

## Quick Start

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "nullcheck": {
      "command": "npx",
      "args": ["-y", "@nullcheck/mcp-server"],
      "env": {
        "NULLCHECK_API_KEY": "nk_your_key_here"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "nullcheck": {
      "command": "npx",
      "args": ["-y", "@nullcheck/mcp-server"],
      "env": {
        "NULLCHECK_API_KEY": "nk_your_key_here"
      }
    }
  }
}
```

### Get an API Key

1. Go to [nullcheck.io/pricing](https://nullcheck.io/pricing)
2. Subscribe to an Agent tier (starts at $49/month for 10,000 API calls)
3. Your key will be generated and emailed — save it, it's shown only once

## Available Tools

### `check_token_risk`

The primary safety check. Analyzes a token for honeypot traps, contract vulnerabilities, holder concentration, and liquidity risks.

**Example prompt:** "Is the token at 0x6982508... on ethereum safe to buy?"

Returns a score from 0-100:
- **LOW (0-14):** Generally safe
- **MEDIUM (15-29):** Some concerns
- **HIGH (30-49):** Significant red flags
- **CRITICAL (50-100):** Likely scam

### `get_trending_tokens`

Find tokens currently trending across DEXes, ranked by volume.

**Example prompt:** "Show me trending tokens on Base"

### `search_tokens`

Find a token by name, symbol, or contract address.

**Example prompt:** "Find the PEPE token on ethereum"

### `get_whale_activity`

Track large wallet transactions (>$10k) over the past 24 hours.

**Example prompt:** "What are whales doing with PEPE on ethereum?"

### `get_whale_holders`

See the largest holders and their percentage of supply.

**Example prompt:** "Who are the top holders of this token?"

### `batch_risk_check`

Analyze multiple tokens at once for portfolio screening.

**Example prompt:** "Check these 5 tokens for risk: [addresses]"

### `get_token_details`

Get full token data: price, volume, liquidity, market cap, and risk.

**Example prompt:** "Get me the details on this token"

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NULLCHECK_API_KEY` | Yes | Your nullcheck API key (starts with `nk_`) |
| `NULLCHECK_API_BASE_URL` | No | Override API base URL (default: `https://api.nullcheck.io`) |

## API Tiers

| Tier | Price | API Calls/Month | Batch Size |
|------|-------|----------------|------------|
| Developer | $49/mo | 10,000 | 10 tokens |
| Professional | $199/mo | 100,000 | 50 tokens |
| Business | $499/mo | 500,000 | 100 tokens |
| Enterprise | Custom | 1M+ | 100 tokens |

## Development

```bash
cd mcp-server
npm install
npm run build
NULLCHECK_API_KEY=nk_test node build/index.js
```

## Coming Soon: LangChain Integration

A Python package `langchain-nullcheck` is planned for LangChain/LlamaIndex agent frameworks, providing the same tools as this MCP server:

```python
# pip install langchain-nullcheck
from langchain_nullcheck import RiskAnalysisTool, TrendingTokensTool

tools = [RiskAnalysisTool(api_key="nk_..."), TrendingTokensTool(api_key="nk_...")]
agent = create_tool_calling_agent(llm, tools, prompt)
```

## License

MIT
