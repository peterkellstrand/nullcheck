# nullcheck API Guide — Deep Reference

## Authentication

All nullcheck API endpoints require authentication via the `X-API-Key` header.

**Key format:** `nk_` followed by 32 alphanumeric characters.
**Example:** `nk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

When using the MCP server, the API key is set via:
1. `NULLCHECK_API_KEY` environment variable (recommended)
2. Passed during MCP server startup

**Tiers and limits:**
| Tier | Price | Daily Requests | Batch Size | Webhooks |
|---|---|---|---|---|
| Developer | $49/mo | 333/day | 10 tokens | 5 |
| Professional | $199/mo | 3,333/day | 50 tokens | Unlimited |
| Business | $999/mo | 10,000/day | 100 tokens | Unlimited |
| Enterprise | Custom | Custom | Custom | Unlimited |

Limits reset daily at midnight UTC.

---

## MCP Tool Reference

### check_token_risk

**Purpose:** The primary safety check. Analyzes a single token for all risk dimensions.

**Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| chain | string | Yes | `ethereum`, `base`, or `solana` |
| address | string | Yes | Token contract address |
| force | boolean | No | Bypass cache for fresh analysis. Default: false. |

**When to use:**
- ALWAYS before buying, swapping, or bridging an unfamiliar token
- When a user asks "is this token safe?"
- When a user shares a contract address and asks about it
- As the first step in any trading workflow

**Response includes:**
- `totalScore` (0-100): Composite risk score
- `level`: `low`, `medium`, `high`, or `critical`
- `honeypot`: Full honeypot analysis with isHoneypot, buyTax, sellTax
- `contract`: Verification status, ownership, mint function, tax limits
- `holders`: Distribution metrics — total count, top 10 concentration, creator holdings
- `liquidity`: Pool depth, LP lock status
- `warnings`: Array of specific findings with severity

**Performance:**
- Cached results: <1 second
- Fresh analysis (new token): 10-30 seconds
- Cache duration: 6 hours
- Use `force: true` to bypass cache (same quota cost)

---

### batch_risk_check

**Purpose:** Screen multiple tokens in one request. Far more efficient than looping check_token_risk.

**Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| tokens | array | Yes | Array of { chain, address } objects |

**When to use:**
- Portfolio risk audit (screen all holdings at once)
- Filtering a trending list for safe tokens
- Watchlist daily scan
- Any time you need to check 3+ tokens

**Batch size limits:** Developer (10), Professional (50), Business/Enterprise (100).

**Response includes:**
- `results`: Map of "chain-address" → risk score objects
- `meta`: { requested, analyzed, cached, failed } counts

**Tips:**
- Tokens already in cache return instantly; only new tokens trigger fresh analysis
- Deduplicates automatically — sending the same token twice costs 1 quota unit, not 2
- If some tokens fail, others still return results (partial success is normal)

---

### get_token_details

**Purpose:** Full profile of a token — identity, price metrics, and risk score (if previously analyzed).

**Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| chain | string | Yes | `ethereum`, `base`, or `solana` |
| address | string | Yes | Token contract address |

**When to use:**
- After risk analysis, to show the user full token data
- When user asks "tell me about this token"
- For price, volume, liquidity, and market cap data

**Response includes:**
- Token identity: name, symbol, decimals, logo
- Metrics: price, priceChange1h, priceChange24h, volume24h, liquidity, marketCap, txns24h, buys24h, sells24h
- Risk: full risk score (if previously analyzed, otherwise null)

---

### get_trending_tokens

**Purpose:** Discover tokens with high recent activity.

**Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| chain | string | No | Filter to specific chain. Omit for all chains. |
| limit | integer | No | Max results (1-100, default 50) |

**When to use:**
- User asks "what's trending?" or "show me new tokens"
- Starting point for token discovery workflows
- Always follow with batch_risk_check to filter unsafe tokens

**Caching:** Results cached for 30 seconds. Suitable for discovery, not real-time monitoring.

---

### search_tokens

**Purpose:** Find a token by name, symbol, or contract address.

**Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| query | string | Yes | Search term — name, symbol (e.g., "PEPE"), or address |
| chain | string | No | Limit to specific chain |
| limit | integer | No | Max results (default 20) |

**When to use:**
- User mentions a token by name ("check PEPE") or symbol
- You need to resolve a name to a contract address before calling check_token_risk
- User asks "find tokens like X"

**Tips:**
- Minimum query length: 2 characters
- Symbol searches are case-insensitive
- Address searches are exact match
- Multiple tokens may share the same name/symbol — present all matches and let user pick

---

### get_whale_activity

**Purpose:** Track large wallet transactions for a token over the past 24 hours.

**Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| chain | string | Yes | `ethereum`, `base`, or `solana` |
| address | string | Yes | Token contract address |

**When to use:**
- User asks "are whales buying or selling?"
- Assessing momentum before a trade
- Monitoring a held token for exit signals

**Response includes:**
- `count24h`: Total whale transactions
- `buyCount24h` / `sellCount24h`: Directional breakdown
- `netFlow24h`: buyCount - sellCount (positive = accumulation, negative = distribution)
- `largestTx`: The single biggest trade in 24h
- `recentTransactions`: Array of individual whale trades with amounts, values, and timestamps

**Definition of "whale":** Transaction > $10,000 USD or > 1% of total supply.

---

### get_whale_holders

**Purpose:** See who owns the most tokens and assess concentration risk.

**Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| chain | string | Yes | `ethereum`, `base`, or `solana` |
| address | string | Yes | Token contract address |

**When to use:**
- Assessing rug pull risk (who can dump?)
- User asks "who are the top holders?"
- Evaluating token distribution quality

**Response includes:**
- `holders`: Array of top holders with address, balance, percent, isContract, isLocked, tag
- `total`: Total holder count
- `limit`: How many holders returned (tier-dependent)

**Tags:** DEX, Burn, Team, LP, Bridge, Staking, Null. These help distinguish real holders from infrastructure addresses.

---

## Workflow Examples

### Example 1: User Says "Buy 1 SOL of BONK"
```
1. search_tokens({ query: "BONK", chain: "solana" })
   → Found: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
2. check_token_risk({ chain: "solana", address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" })
   → Score: 8 (LOW). No honeypot. LP locked. 500K+ holders.
3. get_token_details({ chain: "solana", address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" })
   → Price: $0.00002, Liquidity: $12M, Volume: $45M
4. Response: "BONK looks safe (LOW risk, score 8/100). No honeypot detected, LP is locked,
   well-distributed across 500K+ holders. Current price: $0.00002 with $12M liquidity.
   Proceeding with swap."
→ Hand off to trading tool (Helius/DFlow/etc.)
```

### Example 2: User Says "Is 0xABC...123 Safe?"
```
1. check_token_risk({ chain: "ethereum", address: "0xABC...123" })
   → Score: 72 (CRITICAL). Honeypot detected. Sell tax: 99%.
2. Response: "WARNING: This token is CRITICAL risk (score 72/100).
   Honeypot detected — sell tax is 99%, meaning you would lose nearly all value when trying to sell.
   DO NOT BUY this token. The contract is also unverified and ownership is not renounced."
→ Do NOT proceed with any trade.
```

### Example 3: User Says "Screen My Portfolio" (gives list of 5 tokens)
```
1. batch_risk_check({ tokens: [
     { chain: "ethereum", address: "0x..." },
     { chain: "solana", address: "DezX..." },
     { chain: "base", address: "0x..." },
     { chain: "ethereum", address: "0x..." },
     { chain: "solana", address: "EPj..." }
   ]})
2. Group results:
   CRITICAL (1): Token X — honeypot detected, sell immediately if possible
   HIGH (1): Token Y — unverified contract, LP unlocked, creator holds 15%
   LOW (3): Tokens A, B, C — all pass safety checks
3. Present results with actionable recommendations.
```

---

## Common Mistakes to Avoid

1. **Don't assume a low-risk score means profitable.** Risk analysis is about safety, not returns. A LOW risk token can still lose value naturally.

2. **Don't cache risk scores for more than 6 hours.** Token contracts can be upgraded, LP can be pulled, and holder distribution can change rapidly.

3. **Don't ignore partial batch failures.** If a token in a batch fails to analyze, it means something unusual about the contract. Investigate manually.

4. **Don't skip risk checks on "established" tokens.** Even well-known tokens can have wrapped or forked versions that are scams. Always verify the exact contract address.

5. **Don't treat risk scores as binary.** A score of 14 (LOW) and 15 (MEDIUM) are practically the same. Use the thresholds as guidelines, not hard cutoffs.
