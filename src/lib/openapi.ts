/**
 * OpenAPI 3.1 Specification for nullcheck API
 *
 * AGENT-OPTIMIZED SPECIFICATION
 *
 * This specification has been dramatically expanded with detailed descriptions
 * optimized for LLM/AI agent consumption. Every description includes:
 * - When and why to use each endpoint
 * - How to interpret responses and scores
 * - Concrete thresholds and decision rules
 * - Relationships between fields
 * - Common patterns, workflows, and edge cases
 * - Error conditions and recovery strategies
 *
 * Internal endpoints NOT included: /api/admin/*, /api/cron/*,
 * /api/stripe/*, /api/billing/*, /api/csrf
 */

// =====================================================================
// REUSABLE PARAMETER DEFINITIONS
// =====================================================================

const chainPathParam = {
  name: 'chain',
  in: 'path',
  required: true,
  description: `Blockchain network identifier where the token is deployed. CRITICAL: Use the exact spelling matching the blockchain where the token exists. 'ethereum' = mainnet (most tokens, highest liquidity, established projects), 'base' = Layer 2 by Coinbase (growing ecosystem, lower fees), 'solana' = high-speed chain (many new/experimental tokens). Each blockchain has different risk profiles: Ethereum = most established + highest gas fees, Base = newer + lower fees, Solana = fastest execution + highest scam density. Incorrect chain selection returns 404.`,
  schema: {
    type: 'string',
    enum: ['ethereum', 'base', 'solana'],
  },
};

const addressPathParam = {
  name: 'address',
  in: 'path',
  required: true,
  description: `Token contract address on the specified blockchain. CRITICAL FORMAT RULES: EVM chains (Ethereum, Base) use 0x-prefixed hexadecimal addresses exactly 42 characters long (0x + 40 hex chars), case-insensitive but conventionally checksummed (mixed case). Examples: "0x6B175474E89094C44Da98b954EedeAC495271d0F" (USDC on Ethereum). Solana uses base58 encoding, NOT hexadecimal, typically 32-44 characters long and case-sensitive. Example: "EPjFWaLb3odccjf2cj6ipjbSRBwQqhPgGgZ7ZrA9o9g" (USDC on Solana). COMMON ERRORS: sending EVM address to Solana endpoint, forgetting 0x prefix on Ethereum, using incorrect case on Solana. Malformed addresses return 400 Bad Request. Addresses not found on-chain return 404.`,
  schema: {
    type: 'string',
  },
};

// =====================================================================
// OPENAPI SPEC ROOT
// =====================================================================

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'nullcheck API',
    description: `NULLCHECK: Risk-first Token Analysis API for DeFi

OVERVIEW:
nullcheck detects honeypots, rug pulls, scams, and market manipulation before they cost you money. Analyze any token across Ethereum, Base, and Solana with risk scores, holder analysis, liquidity checks, and smart contract audits.

WHO SHOULD USE THIS API:
- Autonomous trading bots monitoring thousands of tokens
- Portfolio managers screening investments
- Market makers analyzing token safety
- MEV searchers identifying opportunities safely
- Financial advisors checking before recommending tokens
- Researchers tracking DeFi risk patterns

FREE VS PAID:
- FREE: nullcheck.io web interface (rate-limited, no programmatic access)
- PAID: API access starting $49/month (Developer tier: 10,000 requests/month)

API AUTHENTICATION:
All endpoints except /api/health require "X-API-Key" header with format "nk_" followed by 32 base64 characters. Get your key at nullcheck.io/pricing. Keys are not shared across accounts and can be revoked instantly.

RATE LIMITS BY TIER:
- Developer ($49/month): 333 req/day = ~14 req/hour, max 10 in batch, 5 webhooks
- Professional ($199/month): 3,333 req/day = ~139 req/hour, max 50 in batch, unlimited webhooks
- Business ($999/month): 10,000 req/day = ~417 req/hour, max 100 in batch, priority support
- Enterprise: Custom limits, SLA guarantees, dedicated support

CACHING & FRESHNESS:
- Token trending data: cached 30 seconds (good for discovery, less fresh metrics)
- Token details: cached 30 seconds, ETag support for conditional requests
- Risk analyses: cached after computation, use force=true to bypass and get fresh results
- Whale data: updated every 5-10 minutes (near-real-time)
- Price data: updated every 1-2 minutes during market hours

RESPONSE STRUCTURE:
All endpoints return responses with consistent structure:
- data: The actual result (token, risk score, list, etc.)
- metadata: Request ID, timestamp, remaining quota
- error: If request failed, contains code and message

SECURITY & VERIFICATION:
- Webhook payloads signed with HMAC-SHA256 using API key secret
- All communication over HTTPS/TLS 1.3 minimum
- IP whitelisting available for Enterprise customers

AGENT INTEGRATION GUIDE:
1. Get API key from nullcheck.io/pricing (requires payment method)
2. Store key securely in environment variable (never hardcode)
3. Always include "X-API-Key" header in requests
4. Check subscription status at /api/subscription to confirm tier and limits
5. Monitor /api/usage daily to avoid surprise rate limit blocks
6. For screening many tokens: use /api/risk/batch (more efficient) or /api/risk/batch-stream (progressive results)
7. Set up webhooks for critical tokens to get real-time alerts instead of polling
8. Cache risk scores locally when possible (attach analyzedAt timestamp)
9. Implement exponential backoff for 429 Too Many Requests responses (wait 1s, 2s, 4s, 8s...)
10. Always check the "level" field in risk responses (critical = STOP immediately)

COMMON WORKFLOWS:

WORKFLOW 1: Safe Entry Screening
→ GET /api/tokens (discover trending tokens)
→ POST /api/risk/{chain}/{address} (analyze top 10)
→ Filter to risk.level != "critical" and risk.honeypot.isHoneypot == false
→ GET /api/token/{chain}/{address} (get full metrics)
→ Check liquidity > $50,000 and marketCap > $1,000,000
→ Decision: buy/skip based on your risk tolerance

WORKFLOW 2: Portfolio Risk Audit
→ POST /api/risk/batch (send all holdings at once)
→ Group results by risk.level
→ For "critical": sell immediately or investigate
→ For "high": review warnings and holder concentration
→ For "medium" or "low": hold unless other metrics deteriorate

WORKFLOW 3: Real-Time Monitoring
→ POST /api/webhooks (subscribe to risk.critical, whale.sell events for key holdings)
→ Handle webhook payloads (HMAC signature validation required)
→ When critical event: alert user, propose sell, halt new buys
→ Re-analyze weekly with fresh risk scores

WORKFLOW 4: Market Making / AMM Liquidity
→ GET /api/token/{chain}/{address} (check liquidity pool depth)
→ GET /api/whale/{chain}/{address} (check for recent whale exits = dump risk)
→ POST /api/risk/{chain}/{address} (verify no honeypot before providing liquidity)
→ Monitor /api/whale with webhooks for large seller activity

ERROR HANDLING STRATEGY:
- 400: Invalid input (bad address format, invalid chain) → fix request and retry
- 401: Missing/invalid API key → verify key exists and has not been revoked
- 403: Subscription tier too low → upgrade plan or reduce batch size
- 404: Token not found → verify chain and address, may need to analyze first
- 429: Rate limited → exponential backoff, check /api/usage to see current consumption
- 500: Server error → retry after 30 seconds with exponential backoff
- Timeouts: Risk analysis can take 10-30 seconds on new tokens → set timeout >= 60 seconds

BEST PRACTICES FOR AGENTS:
1. ALWAYS analyze for honeypot before executing trades (risk.honeypot.isHoneypot field)
2. Set risk thresholds: reject if risk.level == "critical", warn if == "high"
3. Diversify across tokens: no single token > 5% if risk.level == "medium"
4. Check liquidity before large trades: if liquidity < $100k, order size matters more
5. Monitor holder concentration: if top10Percent > 50%, extra rug pull risk
6. Verify LP is locked: lpLocked == false is a red flag
7. Use webhooks not polling for monitoring (webhooks are free, polling costs quota)
8. Cache risk scores for 1-6 hours (attach analyzedAt timestamp for transparency)
9. Build price confidence: only trade with liquidity > $50,000
10. Trust the composite score: it weights honeypot (50%) > contract (30%) > holders (15%) > liquidity (5%)`,
    version: '1.0.0',
    contact: {
      name: 'nullcheck',
      url: 'https://nullcheck.io',
      email: 'support@nullcheck.io',
    },
    'x-agent-discovery': {
      mcp_server: 'https://www.npmjs.com/package/@nullcheck/mcp-server',
      ai_plugin: 'https://nullcheck.io/.well-known/ai-plugin.json',
    },
  },
  servers: [
    {
      url: 'https://api.nullcheck.io',
      description: 'Production API (use this)',
    },
    {
      url: 'http://localhost:3000',
      description: 'Development (local testing only)',
    },
  ],
  security: [
    { apiKey: [] },
  ],
  tags: [
    {
      name: 'Tokens',
      description: `Token discovery and metadata endpoints. Use these to find and get basic information about tokens: prices, volumes, liquidity, holder counts. These endpoints are the fastest and cheapest quota-wise. Caching: 30 seconds. Use this category for: (1) discovering trending tokens by volume and activity, (2) getting real-time price and liquidity data for tokens you already know about, (3) searching for tokens by name or symbol when you don't have the exact address.`,
    },
    {
      name: 'Risk',
      description: `CRITICAL: Token safety analysis and honeypot detection. These endpoints are the most important for preventing losses. Always run /api/risk before trading. Risk scores are comprehensive: 0-14 (LOW, safe to buy), 15-29 (MEDIUM, monitor closely), 30-49 (HIGH, significant red flags), 50-100 (CRITICAL, likely scam). Honeypot detection has highest weight (50% of score). Use this category for: (1) honeypot detection (before ANY buy), (2) contract vulnerability scanning, (3) holder concentration analysis, (4) liquidity health assessment, (5) batch screening portfolios.`,
    },
    {
      name: 'Whale',
      description: `Whale wallet activity tracking. Whales (large holders) often signal market direction. High whale buy volume = bullish accumulation (but watch for pump-and-dumps). High whale sell volume = bearish distribution. Use this to: (1) detect if whales are accumulating or exiting before price moves, (2) monitor for rugpull risk (sudden large sells), (3) validate bull cases (major holders adding to position). Note: A single whale transaction can move prices 5-20% on low-liquidity tokens, so this matters more for smaller cap coins.`,
    },
    {
      name: 'Alerts',
      description: `Price alerts for watching token movements. Set thresholds (e.g. "alert if PEPE hits $0.000012") and get notified automatically. Useful for: (1) setting buy targets without constantly checking prices, (2) setting stop losses to limit downside, (3) waiting for dips before averaging down, (4) automating entry rules. Alerts persist across sessions; webhooks deliver them in real-time; email for web interface users.`,
    },
    {
      name: 'Watchlist',
      description: `Personal token watchlist. Track tokens you are interested in. Combine with metrics and risk scores to monitor multiple tokens efficiently. Use for: (1) portfolio monitoring (if you own tokens), (2) investment tracking (tokens you are considering), (3) market scanning (tokens worth watching).`,
    },
    {
      name: 'Webhooks',
      description: `Real-time event subscriptions. Instead of polling /api/risk or /api/whale every minute (wastes quota and is slow), subscribe once and get pushed updates when things change. Events include: risk level changes, honeypot detection, whale buy/sell, price movement, etc. Payloads are HMAC-SHA256 signed with your API key secret. Webhooks are free (don't count against quota). Use webhooks to: (1) monitor critical tokens 24/7 without draining quota, (2) react instantly to risk changes or whale activity, (3) build alert systems that scale to thousands of tokens.`,
    },
    {
      name: 'Account',
      description: `Account management, API keys, subscription info, and usage stats. Use to: (1) check your current subscription tier and remaining quota, (2) manage API keys (create new ones, revoke compromised ones), (3) export data in CSV/JSON format, (4) monitor request usage to stay under rate limits.`,
    },
    {
      name: 'System',
      description: `Health check and status endpoints. The /api/health endpoint requires no authentication and is useful for: (1) verifying API is operational before critical requests, (2) detecting outages, (3) loading tests in production.`,
    },
  ],
  paths: {
    // =====================
    // TOKENS (Discovery & Metadata)
    // =====================
    '/api/tokens': {
      get: {
        summary: 'Get trending tokens',
        description: `Discover tokens gaining momentum across DEX markets. Returns ranked list of tokens by 24h volume and transaction count. WHEN TO USE: (1) agent starting a trading session, (2) scanning for new opportunities, (3) finding highly liquid tokens for execution. Each token includes price metrics (current price, 1h/24h changes, volume, liquidity) and OPTIONAL risk score if previously analyzed. DECISION RULES: (1) Filter by chain based on deployment (base = newer low-fee tokens, ethereum = established, solana = volatile/risky). (2) Liquid tokens only: liquidity >= $50,000 (below this = thin markets where $500 trade impacts price). (3) Volume >= $1,000,000/day (below this = low adoption). (4) Use with risk endpoint: don't buy until you verify not honeypot. CACHING: Results cached 30 seconds (good for discovery, not for live trading). RESPONSE: Array of tokens with chainId, address, symbol, name, price, priceChange24h, volume24h, liquidity, txns24h. AGENT INTEGRATION: Use this to populate a list of candidates, then filter by risk score, then execute trades on safest ones first. Example: Get top 50, analyze for honeypot in batch, take bottom 5 by risk score, check liquidity > $100k, execute buys.`,
        operationId: 'getTrendingTokens',
        tags: ['Tokens'],
        parameters: [
          {
            name: 'chain',
            in: 'query',
            description: `Filter trending tokens to a single blockchain. BEHAVIOR: (1) omit this parameter = trending across all chains mixed together, (2) chain=ethereum = only Ethereum mainnet tokens, (3) chain=base = only Base/Layer2 tokens, (4) chain=solana = only Solana tokens. USE CASE: If you want to focus on low-fee/fast execution, use base or solana; if you want established coins, use ethereum. CONSTRAINT: Can only filter to one chain at a time; use multiple requests for multi-chain comparison.`,
            schema: {
              type: 'string',
              enum: ['ethereum', 'base', 'solana'],
            },
          },
          {
            name: 'limit',
            in: 'query',
            description: `Maximum number of trending tokens to return. PRACTICAL VALUES: (1) 10 = quick scan, only super-hot tokens, (2) 50 = default comprehensive scan (recommended), (3) 100 = deep scan all trending tokens. LIMITS: minimum 1, maximum 100. DEFAULT: 50. Each additional token costs 1 quota unit, so requesting 100 costs 100 units (not 1). BEHAVIOR: Returns ordered by volume (highest first), so taking first 10 is usually more liquid than randomly sampling from 100.`,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
            },
          },
        ],
        responses: {
          '200': {
            description: `Success: Trending tokens with metrics and optional risk. STRUCTURE: { data: { tokens: [{ address, chainId, symbol, name, price, priceChange1h, priceChange24h, volume24h, liquidity, txns24h, risk: { totalScore, level } }] }, metadata: { cached: true, cacheAge: 15 } }. Note: risk field is OPTIONAL (null if not previously analyzed). If you need risk scores, use POST /api/risk/batch after getting this list.`,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TokensResponse',
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/api/token/{chain}/{address}': {
      get: {
        summary: 'Get token details',
        description: `Fetch comprehensive data for a specific token you have identified. Returns: symbol, name, decimals, logo, current price, 24h volume, liquidity, market cap, holder count, transaction counts (buys vs sells), and optionally cached risk score. WHEN TO USE: (1) You already have the token address/chain, (2) you want current metrics before deciding to trade, (3) you need to verify token is legitimate (check decimals, has logo, has volume), (4) you want to fetch holder metrics. INTERPRETATION: (1) liquidity < $10k = extremely thin, avoid trading, (2) liquidity $10k-$100k = thin markets, large orders move price, (3) liquidity > $100k = tradeable, (4) volume24h < $1m = low adoption/low float, (5) holders < 100 = suspicious (likely airdrop/scam), (6) top10Percent > 50% = rug risk. CACHING: 30 seconds with ETag support. If you want latest price mid-trade, add header "If-None-Match" with previous ETag to get 304 (use cached copy) vs 200 (fresh). FRESH RISK: If risk score is stale (> 1 hour old), call POST /api/risk/{chain}/{address} with force=true to get updated analysis. ERROR: Returns 404 if token has no holders or zero volume (not a real token).`,
        operationId: 'getToken',
        tags: ['Tokens'],
        parameters: [chainPathParam, addressPathParam],
        responses: {
          '200': {
            description: `Success: Full token metrics. FIELDS EXPLAINED: (1) address = contract address (exact match to your input), (2) chainId = blockchain (ethereum/base/solana), (3) symbol = ticker (PEPE, USDC, etc), (4) name = full name, (5) decimals = token precision (18 for most ERC-20, 6 for USDC), (6) price = USD value right now (cached ~2min), (7) priceChange1h/24h = percentage change (negative = losing value), (8) volume24h = total USD traded in 24h (higher = more liquidity), (9) liquidity = total USD in DEX pools, (10) marketCap = price * circulating supply (null if supply unknown), (11) holders = unique wallet addresses holding token, (12) txns24h = total buy/sell count in 24h, (13) buys24h/sells24h = split (if buys >> sells = accumulation, vice versa = distribution). DECISION FRAMEWORK: (a) liquidity < $50k AND you want to buy > $5k = risk pool is too thin, order will move price 5-10% and slippage will kill you, (b) holders < 50 = huge red flag, nearly all tokens have 50+ holders naturally, (c) top10Percent > 60% = founders/early VCs own majority, rug pull risk is extreme, (d) high volume + low holders = pump and dump in progress.`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TokenDetailResponse' },
              },
            },
          },
          '404': {
            description: `Token not found. CAUSES: (1) Address does not exist on specified chain, (2) token has 0 holders (contract exists but never transferred), (3) token has 0 volume (no trades ever occurred). FIX: Verify address is exact match, check you are using correct chain, confirm token is deployed (use Etherscan/Solscan to cross-check).`,
            $ref: '#/components/responses/NotFound'
          },
        },
      },
    },
    '/api/search': {
      get: {
        summary: 'Search tokens by name/symbol/address',
        description: `Find a token when you know its name or symbol but need the exact contract address and chain. WHEN TO USE: (1) User says "find PEPE", (2) you have ticker symbol but not address, (3) you have partial address string, (4) you are disambiguating between multiple tokens with same symbol (yes, there are multiple PEPE tokens on different chains). SEARCH MATCHING: Case-insensitive substring matching on symbol, name, and address. If query="usdc" returns USDC tokens on all chains. MINIMUM LENGTH: Query must be >= 2 characters (searches for "a" or "0x" are rejected). RETURNS: Basic token info (address, chainId, symbol, name, decimals, logo) but NOT metrics. Use the result address with GET /api/token/{chain}/{address} to get full metrics. TIMING: Searches are NOT cached and may take 2-5 seconds if querying across all chains. Chain filter speeds this up. DISAMBIGUATION: If query returns multiple results (e.g., "USDC" on Ethereum, Base, Solana), results are sorted by liquidity (highest first), so first result is usually what you want.`,
        operationId: 'searchTokens',
        tags: ['Tokens'],
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            description: `Search query string. VALID INPUTS: (1) token symbol (case-insensitive): "pepe", "USDC", "shib", (2) token name: "uniswap", "aave", "lido", (3) contract address (partial ok): "0x6b17", "EPjFWaLb3od" (just the prefix). MINIMUM LENGTH: 2 characters. INVALID: Single character "a" or "0" rejected. MATCHING: Performs case-insensitive substring match, so "usd" matches "USDC". AMBIGUITY: If multiple tokens match, e.g. "PEPE" returns PEPE on Ethereum, Base, and Solana, then you need to disambiguate by checking results or using chain filter.`,
            schema: { type: 'string', minLength: 2 },
          },
          {
            name: 'chain',
            in: 'query',
            description: `Limit search to a single blockchain. BEHAVIOR: If chain is set, only searches tokens on that chain (10x faster). If chain is omitted, searches all chains and aggregates results. RECOMMENDED: Always provide chain if you know it (faster response, fewer ambiguous results). USE CASE: User says "find USDC on Ethereum" → use chain=ethereum to get instant result vs searching all chains.`,
            schema: { type: 'string', enum: ['ethereum', 'base', 'solana'] },
          },
          {
            name: 'limit',
            in: 'query',
            description: `Maximum number of search results to return. DEFAULT: 20. PRACTICAL: If you are implementing autocomplete, use limit=5-10 for faster response. If doing batch lookup, use limit=20. If you care about finding ALL matches, use limit=50 and check if results array has exactly 50 items (may be truncated). ORDERING: Results ordered by relevance (exact symbol matches first) and by liquidity (most liquid first).`,
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          '200': {
            description: `Success: Array of matching tokens. STRUCTURE: { data: { results: [{ address, chainId, symbol, name, decimals, logoUrl }] }, metadata: { matched: true } }. NOTE: This endpoint returns basic info ONLY. To get metrics (price, volume, liquidity), use GET /api/token/{chain}/{address} with the address from this result. ERROR: Empty results array if no matches found (not an error status).`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SearchResponse' },
              },
            },
          },
        },
      },
    },

    // =====================
    // RISK ANALYSIS (Core Safety)
    // =====================
    '/api/risk/{chain}/{address}': {
      get: {
        summary: 'Get cached risk analysis (if exists)',
        description: `Check if this token has been analyzed for risk already and return cached result. WHEN TO USE: (1) You want to avoid triggering a fresh 10-30 second analysis, (2) you want to check if analysis exists before buying fresh, (3) you need instant response. RETURNS: If cached, returns RiskResponse with totalScore (0-100), level (low/medium/high/critical), and sub-scores (liquidity/holders/contract/honeypot). INTERPRETATION: totalScore 0-14 = safe buy, 15-29 = caution, 30-49 = red flags, 50-100 = do not buy. Honeypot score (0-50) is weighted 50% of total, so if honeypot=true, entire score becomes critical. ERROR: Returns 404 if no cached analysis exists for this token. In this case, use POST method instead to analyze fresh. CACHE AGE: You cannot see how old the cache is in this endpoint; if you need fresh data, use POST with force=true. AGENT PATTERN: (1) Try GET first (fast), (2) if 404, then POST (slower), (3) use result either way.`,
        operationId: 'getRiskAnalysis',
        tags: ['Risk'],
        parameters: [chainPathParam, addressPathParam],
        responses: {
          '200': {
            description: `Success: Cached risk analysis exists. Returns full RiskResponse with totalScore 0-100, level (string), honeypot detection, holder concentration, contract risks, warnings array.`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RiskResponse' },
              },
            },
          },
          '404': {
            description: `No cached analysis. CAUSES: (1) Token has never been analyzed before, (2) cache expired and no one has re-analyzed recently. SOLUTION: Use POST method to analyze fresh. Takes 10-30 seconds depending on data availability.`,
          },
        },
      },
      post: {
        summary: 'Analyze token risk (fresh analysis)',
        description: `CRITICAL SAFETY ENDPOINT. The most important call you will make before trading. Analyzes token for honeypot traps, rug pulls, contract vulnerabilities, holder concentration, and liquidity risks. Returns composite risk score 0-100 with interpretation. WHEN TO ALWAYS USE: (1) BEFORE any purchase of unfamiliar token, (2) quarterly for holdings, (3) when considering DEX LP positions, (4) before moving large position sizes. TIMING: Fresh analysis takes 10-30 seconds (pulls blockchain data, analyzes smart contract, calculates metrics). Browser queries are queued if server is busy. Use force=true to bypass cache and guarantee fresh data (useful after recent whale activity).

RISK SCORE INTERPRETATION - CRITICAL FOR DECISION MAKING:
- 0-14 (LOW): Safe to trade. Still check liquidity > $50k and not a scam symbol (fake USDC, etc).
- 15-29 (MEDIUM): Some concerns. Review specific warnings. Hold position size < 5% portfolio. Monitor for changes.
- 30-49 (HIGH): Significant red flags. Do not invest new money. Consider exiting. Something is wrong: high holder concentration, low liquidity, suspicious contract, or 1-2 serious warnings.
- 50-100 (CRITICAL): Almost certainly a scam or honeypot. Sell immediately if holding. Do not buy under any circumstances.

SUB-SCORE BREAKDOWN (Understanding the Components):
- Honeypot (0-50 points): HIGHEST WEIGHT. If isHoneypot=true, buying may result in tokens you cannot sell. This alone makes totalScore >= 50 (CRITICAL).
- Contract (0-30 points): Smart contract red flags. hasMintFunction=true (can print infinite tokens), renounced=false (creator retains control), maxTaxPercent > 10% (huge fees), unverified source code.
- Holders (0-15 points): Distribution risk. top10Percent > 60% means founders own majority (rugpull risk). creatorHoldingPercent > 10% means founder still holding (may dump). totalHolders < 100 means not naturally distributed.
- Liquidity (0-5 points): Pool health. Highest liquidity = lowest risk here. lpLocked=false means LP tokens NOT locked (can be pulled). liquidity < $10k = untradeable.

WEIGHTING FORMULA (Approximate):
totalScore = (honeypot * 50%) + (contract * 30%) + (holders * 15%) + (liquidity * 5%)
This means honeypot findings dominate the score.

RESPONSE FIELDS - What Each Means:
- totalScore: 0-100, use with level field (both indicate same risk)
- level: Human readable (low/medium/high/critical), matches score ranges above
- warnings: Array of specific risk findings with severity codes (e.g., "high_holder_concentration", "unverified_contract")
- honeypot.isHoneypot: BOOLEAN - if true, you CANNOT sell this token. Do not buy.
- honeypot.buyTax / sellTax: Percentage tax on buy/sell (0-100). Normal: 0-2%. Suspicious: 5-10%. Honeypot: 50-100% or 0% buy but 100% sell.
- contract.hasMintFunction: If true, creator can print infinite tokens and dump on holders
- contract.renounced: If false, creator retains control and can change rules
- liquidity.lpLocked: If false, someone can pull liquidity and crash price
- holders.top10Percent: If > 60%, top 10 wallets own majority (rug pull risk)

EDGE CASES & GOTCHAS:
1. New tokens (< 1 hour old): May show high risk due to low holder count even if legitimate. Check if founder/team are verified.
2. Deflationary tokens: Reduce total supply over time, can show as "no mint function" but still dangerous if burn function is pausable.
3. Reflection tokens: Reward holders for holding, harder to analyze. Check if rewards are from LP fees (safe) vs dilution (risky).
4. Proxy contracts: Some tokens use proxy patterns, analysis may not catch all risks. Always verify source code is verified.
5. Wrapped tokens: Wrapped versions of established tokens (e.g., wrapped BTC) may show false highs if wrapper is new. Check if 1:1 backed.

RETRY BEHAVIOR:
If you get timeout, retry after 30 seconds with exponential backoff. Analysis computation is not retryable mid-stream (either completes or times out).

CACHING & FRESHNESS:
After successful analysis, result is cached for 6 hours. If you want latest data before that, set force=true to bypass cache. Cost is same (1 quota unit) either way.`,
        operationId: 'analyzeRisk',
        tags: ['Risk'],
        parameters: [chainPathParam, addressPathParam],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  symbol: {
                    type: 'string',
                    description: `Token symbol (e.g., "PEPE", "USDC"). OPTIONAL. Helps identify token in analysis logs and results. If omitted, API looks it up automatically. Include if you already know it (faster for API to skip lookup).`
                  },
                  name: {
                    type: 'string',
                    description: `Token name (e.g., "Pepe Inu"). OPTIONAL. Also for identification. Omit if unknown.`
                  },
                  poolAddress: {
                    type: 'string',
                    description: `DEX pool address where liquidity is concentrated. OPTIONAL. For advanced users: if you know the exact Uniswap/Raydium pool address, provide it for more accurate liquidity analysis. Omit if you don't know it (API will find pools automatically).`
                  },
                  force: {
                    type: 'boolean',
                    description: `Force fresh analysis, bypass cache. DEFAULT: false. BEHAVIOR: (1) force=false = return cached result if exists (instant), fetch fresh if not cached, (2) force=true = always perform fresh analysis (10-30 seconds). USE CASE: Set to true if token metrics changed recently (whale activity, new liquidity event) and you need updated risk assessment. Costs same quota as cached, so no penalty to forcing fresh analysis.`
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: `Success: Risk analysis complete. Check totalScore and level fields to make decision. Review warnings array for specific concerns. If honeypot.isHoneypot=true, STOP and do not buy.`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RiskResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/api/risk/batch': {
      post: {
        summary: 'Batch risk analysis (all results at once)',
        description: `Analyze multiple tokens in a single request for portfolio screening or discovery filtering. Returns all results as one batch. WHEN TO USE: (1) Screening a watchlist or portfolio of tokens, (2) filtering trending tokens before trading, (3) running daily portfolio health check. BATCH SIZE LIMITS BY TIER: Developer (10 tokens), Professional (50), Business (100). Exceeding limit returns 400 error. COST: Counts as N quota units where N = number of tokens (so analyzing 10 tokens costs 10 units). Tokens already in cache return instantly; only fresh tokens incur latency.

EFFICIENCY TIPS:
1. Deduplicate input array (if same token appears twice, provide once)
2. Order by importance (analyze highest priority tokens first in case batch times out)
3. Always provide chainId with each token (omitting causes 400 error)
4. Reuse results for 1-6 hours by storing analyzedAt timestamp
5. Use streaming endpoint if batch > 50 and you want results incrementally

ERROR RECOVERY:
- If batch=50 times out, split into 2 batches of 25
- Retry with exponential backoff (1s, 2s, 4s, 8s, then give up)
- Check /api/usage after failure to see if you hit quota limit (429) vs timeout (504)

RESPONSE STRUCTURE:
Returns { data: { results: [{ address, chainId, totalScore, level, warnings, honeypot, ... }] }, metadata: { analyzed: 43, cached: 7, totalTime: 18500 } }
The metadata tells you how many were fresh (analyzed) vs cache hit (cached), and total time in milliseconds.`,
        operationId: 'batchRiskAnalysis',
        tags: ['Risk'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tokens'],
                properties: {
                  tokens: {
                    type: 'array',
                    description: `Array of tokens to analyze. REQUIRED: Each object must have address and chainId. OPTIONAL: symbol, name. VALIDATION: (1) address must match chain format (0x... for EVM, base58 for Solana), (2) chainId must be in [ethereum, base, solana], (3) deduplicate before sending (same token twice wastes quota). MAX: 10-100 depending on tier. CONSTRAINT: All tokens in one batch; cannot split batch across requests then merge results (each request returns complete independent analysis).`,
                    items: {
                      type: 'object',
                      required: ['address', 'chainId'],
                      properties: {
                        address: {
                          type: 'string',
                          description: `Token contract address. Must match chain format (0x-prefixed for Ethereum/Base, base58 for Solana).`
                        },
                        chainId: {
                          type: 'string',
                          enum: ['ethereum', 'base', 'solana'],
                          description: `Blockchain network where token is deployed.`
                        },
                        symbol: {
                          type: 'string',
                          description: `OPTIONAL. Token symbol (PEPE, USDC, etc). Speeds up lookup if included.`
                        },
                        name: {
                          type: 'string',
                          description: `OPTIONAL. Full token name. Also speeds up lookups.`
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: `Success: Batch results. Returns array of RiskResponse objects. IMPORTANT: Results are returned even if some fail individually. Check each result.error field to identify which tokens failed (e.g. "Token not found", "Invalid address"). Use metadata.analyzed vs metadata.cached to understand performance.`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BatchRiskResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/api/risk/batch-stream': {
      post: {
        summary: 'Streaming batch risk analysis (SSE, results as they complete)',
        description: `Like /api/risk/batch but streams results as Server-Sent Events (SSE). WHEN TO USE: (1) Analyzing large batch (50-100 tokens), (2) you want to start processing results before all complete, (3) progressive filtering (analyze, then discard high-risk, then drill into survivors). RESPONSE FORMAT: Server-Sent Events (one event per token or progress update). Each event is JSON line with type (progress, result, error).

PARSING:
JavaScript: const eventSource = new EventSource(url); eventSource.onmessage = (evt) => { const data = JSON.parse(evt.data); if (data.type === 'result') { process(data.result); } };
Python: requests.post(url, stream=True) → for line in response.iter_lines() → JSON parse each line.

EVENTS:
- progress: { type: 'progress', analyzed: 5, cached: 2, remaining: 43 } (informational)
- result: { type: 'result', data: { address, chainId, totalScore, level, ... } } (token analysis)
- error: { type: 'error', address, message: '...' } (single token failed, continue)

TIMEOUT HANDLING:
Request stays open until all tokens analyzed or 5-minute timeout. If timeout, last results are sent before connection closes. Caller should check count of results vs input to detect incomplete batches.

COST: Same as batch (N quota units for N tokens). You cannot get "partial refund" for incomplete request. Streaming does not reduce quota cost; it just spreads processing over time so you see results earlier.

USE PATTERN:
POST /api/risk/batch-stream with tokens=[...50 tokens...]
- First token result arrives in 2-3 seconds
- Process it: if level=critical, stop processing; otherwise queue for next action
- Remaining tokens complete over next 20-30 seconds
- When stream closes, you have all results (or know what timed out)`,
        operationId: 'batchRiskAnalysisStream',
        tags: ['Risk'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tokens'],
                properties: {
                  tokens: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['address', 'chainId'],
                      properties: {
                        address: {
                          type: 'string',
                          description: `Token contract address.`
                        },
                        chainId: {
                          type: 'string',
                          enum: ['ethereum', 'base', 'solana'],
                          description: `Blockchain network.`
                        },
                        liquidity: {
                          type: 'number',
                          description: `OPTIONAL. If you already know token liquidity, include it here to speed up analysis (API won't need to fetch it).`
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: `Success: Returns HTTP 200 with Content-Type: text/event-stream. SSE connection opened. Events streamed as they are ready. Close connection after processing all results or on timeout.`,
            content: {
              'text/event-stream': {
                schema: {
                  type: 'object',
                  description: 'Server-Sent Events stream. Each event is a JSON object with type and payload.',
                },
              },
            },
          },
        },
      },
    },

    // =====================
    // WHALE ACTIVITY (Large Holder Tracking)
    // =====================
    '/api/whale/{chain}/{address}': {
      get: {
        summary: 'Get whale activity',
        description: `Track large wallet transactions for token. Whales (holders of significant token amounts) often signal price direction. WHEN TO USE: (1) Monitor for whale exits (distribution = bearish), (2) Monitor for whale entries (accumulation = bullish), (3) Detect pump-and-dump schemes (big buy then exit), (4) Validate bull thesis (major holders accumulating). INTERPRETATION: Count buys vs sells in 24h. If buys > sells = accumulation (bullish signal). If sells > buys = distribution (bearish). Single large transaction value tells you about buying power available. LIMITATIONS: "Whale" threshold varies by token (for $1B market cap token, whale = $1M+; for $10M token, whale = $100k+). API auto-detects threshold per token. Returns top 10 transactions in 24h.

DATA FIELDS:
- netFlow24h: (buys - sells) in 24h. Positive = accumulation. Negative = distribution.
- largestTx: Biggest single transaction (shows max order size executed)
- recentTransactions: 10 most recent whale transactions with timestamp and amount
- If netFlow24h is positive by 3+, whales are accumulating (likely bullish event coming)
- If netFlow24h is negative by 3+, whales are exiting (likely bearish event coming)

RISK ASSESSMENT WITH WHALES:
- If risk.level=critical AND whale buys = red flag, likely pump to dump
- If risk.level=low AND whale buys = confirmation of safety (whales would not buy scams)
- If risk.level=high AND whale sells = confirms danger
- If token is < 1 hour old, ignore whale data (no historical activity yet)

MONITORING PATTERN:
Set webhook for whale.sell events on tokens you hold. When alert triggers, check risk score for new warnings. If both whale selling AND risk changed to high, consider exiting immediately.`,
        operationId: 'getWhaleActivity',
        tags: ['Whale'],
        parameters: [chainPathParam, addressPathParam],
        responses: {
          '200': {
            description: `Success: Whale activity data with transaction summary and recent transactions. netFlow24h shows net direction (accumulation vs distribution).`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WhaleActivity' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // =====================
    // HOLDERS (Distribution Analysis)
    // =====================
    '/api/holders/{chain}/{address}': {
      get: {
        summary: 'Get token holder list',
        description: `Returns list of wallet addresses holding token, ordered by balance. Shows holder concentration and identifies locked/contract holders. WHEN TO USE: (1) Assessing rug pull risk (if founders hold 50%+ supply), (2) Identifying exchanges/DEXes (contract holders), (3) Spotting locked LP tokens, (4) Verifying distribution health. INTERPRETATION: If top 10 holders own > 60% of supply, rug pull risk is extreme. If many holders are contracts (DEXes, vaults), distribution is good. If top holder is unverified wallet with 30%+ supply, high concentration risk.

FIELDS EXPLAINED:
- balance: Raw token amount (not USD value). Must divide by 10^decimals to get human-readable amount.
- percent: Percentage of total supply this holder owns. If > 50%, this one wallet can crash price.
- isContract: If true, this is a smart contract (likely DEX, vault, bridge). Less rug pull risk from contracts.
- isLocked: If true, tokens are locked in vesting/LP lock contract. Cannot be immediately sold.
- tag: Labels for known addresses (DEX, Burn address, Team vesting, LP, etc.)

RISK METRICS FROM HOLDERS DATA:
- top10Percent = sum of percent field for 10 largest holders. If > 60%, extreme concentration.
- creatorHoldingPercent = first holder with tag='Team' or unlabeled initial holder. If > 10%, founder still heavily vested.
- If top3Percent > 50%, this token is very vulnerable to whale dumps.

PAGINATION:
Limit parameter controls how many results to return. Default 100 (top 100 holders). For full distribution, may need to request limit=1000 (max). Note: Requesting 1000 holders costs more than 100 but same quota unit (not paginated).

DECISION FRAMEWORK:
(1) Count holders: < 50 = suspicious/new/scam. > 1000 = well distributed. > 10000 = very healthy.
(2) Check top10Percent: < 30% = safe. 30-50% = monitor. > 50% = avoid.
(3) Identify contracts: Many contract holders = good (distributed across exchanges). Few = bad (concentrated in retail).
(4) Check for locks: If top holder is locked for 6+ months, rug pull risk is low for that timeframe.`,
        operationId: 'getHolders',
        tags: ['Holders'],
        parameters: [
          chainPathParam,
          addressPathParam,
          {
            name: 'limit',
            in: 'query',
            description: `Maximum holders to return. DEFAULT: 100 (top 100 by balance). MAX: 1000. Use 100 for quick assessment, 500-1000 for detailed distribution analysis. Each request returns top N; no pagination available. COST: Same quota (1 unit) regardless of limit.`,
            schema: { type: 'integer', default: 100, maximum: 1000 },
          },
        ],
        responses: {
          '200': {
            description: `Success: Array of token holders ordered by balance (largest first). Each holder shows address, balance, percentage, contract flag, lock flag, and tag if known.`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HoldersResponse' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // =====================
    // PRICE ALERTS
    // =====================
    '/api/alerts': {
      get: {
        summary: 'List price alerts',
        description: `Get all price alerts set by this API key. Shows target prices, trigger status, and whether notification was sent. WHEN TO USE: (1) Check alerts before logging off, (2) verify alert was created, (3) manage alert list (delete stale ones). Returns alerts sorted by creation date (newest first).`,
        operationId: 'listAlerts',
        tags: ['Alerts'],
        responses: {
          '200': {
            description: `Success: Array of PriceAlert objects. Each shows id (UUID), token info, alert type (price_above or price_below), target price, current triggered status, and notification status.`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AlertsListResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        summary: 'Create price alert',
        description: `Set a price target and get notified when reached. Use for: (1) Buy targets ("alert me when PEPE hits $0.00005"), (2) Sell targets/stop losses ("alert me if ETH drops below $3000"), (3) automation ("when alert triggers, execute trade"). ALERT TYPES: price_above = notify when current >= target (for buy targets), price_below = notify when current <= target (for stop losses). DELIVERY: (1) Web users get email + in-app notification, (2) API users can set webhook instead (or both). LIMITS BY TIER: Developer (10 alerts), Professional (100), Business+ (1000). NOTIFICATIONS: Triggered once. Once alert fires, isTriggered=true and notificationSent=true. Alert persists in list but does not fire again at same price.

WORKFLOW PATTERN:
→ POST /api/alerts { chainId: ethereum, tokenAddress: 0x..., alertType: price_below, targetPrice: 2500 } (set stop loss)
→ GET /api/alerts (verify alert created and not yet triggered)
→ Wait for notification (webhook or email)
→ DELETE /api/alerts/{alertId} (clean up triggered alert)`,
        operationId: 'createAlert',
        tags: ['Alerts'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['chainId', 'tokenAddress', 'alertType', 'targetPrice'],
                properties: {
                  chainId: {
                    type: 'string',
                    enum: ['ethereum', 'base', 'solana'],
                    description: `Blockchain where token is deployed.`
                  },
                  tokenAddress: {
                    type: 'string',
                    description: `Token contract address. Must match chain format.`
                  },
                  tokenSymbol: {
                    type: 'string',
                    description: `OPTIONAL. Token symbol (PEPE, ETH, etc). For reference; speeds up lookup.`
                  },
                  tokenName: {
                    type: 'string',
                    description: `OPTIONAL. Token name. Also for reference.`
                  },
                  alertType: {
                    type: 'string',
                    enum: ['price_above', 'price_below'],
                    description: `Alert trigger condition. price_above = fire when current price >= target (buy signals). price_below = fire when current <= target (sell signals/stop loss).`
                  },
                  targetPrice: {
                    type: 'number',
                    description: `Target price in USD. Must be positive number. Recommend using at least 4-6 decimal places for low-value tokens (e.g., 0.000015 for PEPE). Integer is fine for USD-pegged tokens (e.g., 2500 for ETH).`
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: `Success: Alert created. Returns PriceAlert object with id (save this for later delete), createdPrice (current price at creation), isTriggered=false, notificationSent=false.`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PriceAlert' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/alerts/{alertId}': {
      delete: {
        summary: 'Delete price alert',
        description: `Remove a price alert so it no longer fires. WHEN TO USE: (1) Alert triggered and you acted on it (can clean up), (2) Changed your mind about the target, (3) Token is delisted. Deleting alert stops further notifications immediately.`,
        operationId: 'deleteAlert',
        tags: ['Alerts'],
        parameters: [
          {
            name: 'alertId',
            in: 'path',
            required: true,
            description: `UUID of alert to delete. Get from POST /api/alerts response or GET /api/alerts list.`,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: `Success: Alert deleted.`,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { success: { type: 'boolean', enum: [true] } },
                },
              },
            },
          },
          '404': {
            description: `Alert not found. CAUSE: alertId does not exist or already deleted.`,
          },
        },
      },
    },

    // =====================
    // WATCHLIST (Personal Token Tracking)
    // =====================
    '/api/watchlist': {
      get: {
        summary: 'Get watchlist',
        description: `Retrieve list of tokens in your watchlist (tokens you want to monitor). Returns addresses and basic info. WHEN TO USE: (1) Verify what's in your watchlist, (2) before bulk operations. For full metrics (price, volume, risk), use GET /api/watchlist/tokens instead. LIMITS: Free tier (50 tokens), Pro (500), Business+ (5000).`,
        operationId: 'getWatchlist',
        tags: ['Watchlist'],
        responses: {
          '200': {
            description: `Success: Array of basic token info from watchlist (address, chainId, symbol, name, logoUrl). No metrics included. For metrics, use /api/watchlist/tokens.`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WatchlistResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        summary: 'Add token to watchlist',
        description: `Add a token to your personal watchlist. Use before analyzing or trading to mark as interesting. WHEN TO USE: (1) After discovering token and thinking "this looks good", (2) before running analysis, (3) before buying. Adding same token twice is idempotent (second add returns success without creating duplicate). ORGANIZATION: Watchlist is simple (just an address list); use external tools to tag/organize if needed.`,
        operationId: 'addToWatchlist',
        tags: ['Watchlist'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['address', 'chainId'],
                properties: {
                  address: {
                    type: 'string',
                    description: `Token contract address.`
                  },
                  chainId: {
                    type: 'string',
                    enum: ['ethereum', 'base', 'solana'],
                    description: `Blockchain.`
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: `Success: Token added to watchlist (or already was present, returns same response).`,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { success: { type: 'boolean', enum: [true] } },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/watchlist/{chain}/{address}': {
      delete: {
        summary: 'Remove token from watchlist',
        description: `Remove a token from watchlist (no longer want to monitor). Deleting does not affect your positions if you hold the token; it just removes from watch list. IDEMPOTENT: Removing token not in list returns success (no error).`,
        operationId: 'removeFromWatchlist',
        tags: ['Watchlist'],
        parameters: [chainPathParam, addressPathParam],
        responses: {
          '200': {
            description: `Success: Token removed (or was not in list, same response).`,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { success: { type: 'boolean', enum: [true] } },
                },
              },
            },
          },
        },
      },
    },
    '/api/watchlist/tokens': {
      get: {
        summary: 'Get watchlist tokens with full metrics',
        description: `Returns full token data (price, volume, liquidity, risk score) for all tokens in watchlist. WHEN TO USE: (1) Portfolio monitoring (check all your watchlist tokens at once), (2) daily healthcheck (scan all watchlist for risk changes), (3) before deciding which to trade. This is the expensive version of /api/watchlist (includes metrics). Use /api/watchlist if you only need addresses. COST: Counts as 1 quota unit regardless of watchlist size (batch request).`,
        operationId: 'getWatchlistTokens',
        tags: ['Watchlist'],
        responses: {
          '200': {
            description: `Success: Array of full token data (symbol, name, price, volume24h, liquidity, marketCap, txns24h, risk score). Use risk.level to identify which tokens need attention.`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WatchlistTokensResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // =====================
    // WEBHOOKS (Real-time Notifications)
    // =====================
    '/api/webhooks': {
      get: {
        summary: 'List webhook subscriptions',
        description: `Get all active webhook subscriptions for this API key. Shows target URL, events, and last delivery status. WHEN TO USE: (1) Verify webhook is configured, (2) check if webhook is still active, (3) delete old subscriptions. Webhooks are the efficient way to monitor tokens 24/7 without polling. Each webhook costs 1 quota unit per delivery, not per request (so much cheaper than checking status every minute).`,
        operationId: 'listWebhooks',
        tags: ['Webhooks'],
        responses: {
          '200': {
            description: `Success: Array of webhook subscriptions with id, url, events, active status, and last delivery timestamp/status.`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WebhooksListResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        summary: 'Create webhook subscription',
        description: `Subscribe to real-time events via webhook. Instead of polling the API every minute (wasteful), set up a webhook and we'll POST your application whenever an event happens. EVENTS: risk.high, risk.critical, risk.honeypot, whale.buy, whale.sell, price.increase, price.decrease. SELECT MULTIPLE: Include array of event types in request. DELIVERY: Payloads signed with HMAC-SHA256 using your API secret. Your application must verify signature (prevent injection attacks). RETRY POLICY: We retry failed deliveries 3 times with exponential backoff (1s, 10s, 100s). After 3 failures, delivery is abandoned (no more retries). QUOTA: Each successful delivery costs 1 quota unit. Repeated events for same token do not cost extra (batched per 5-minute window). TIER LIMITS: Developer (5 webhooks max), Professional/Business (unlimited).

SETUP PATTERN:
1. Create endpoint on your server (e.g., https://mybot.example.com/webhooks/nullcheck)
2. POST /api/webhooks { url, events: ["risk.critical", "whale.sell"] }
3. Save subscriptionId from response
4. Implement signature verification in your endpoint (HMAC-SHA256 with X-Webhook-Signature header)
5. Test with POST /api/webhooks/test { subscriptionId }
6. Watch for incoming events

SIGNATURE VERIFICATION (Node.js pseudocode):
  const hmac = crypto.createHmac('sha256', apiKeySecret);
  hmac.update(request.rawBody); // must be raw bytes, not JSON parsed
  const signature = hmac.digest('hex');
  if (signature !== request.headers['x-webhook-signature']) return 403;
  // Trust the payload, process it`,
        operationId: 'createWebhook',
        tags: ['Webhooks'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WebhookCreateRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: `Success: Webhook subscription created. Returns subscriptionId and webhook metadata. Save subscriptionId for later operations.`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WebhookResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '403': {
            description: `Webhook limit reached (tier limit on number of webhooks).`,
          },
        },
      },
    },
    '/api/webhooks/{subscriptionId}': {
      delete: {
        summary: 'Delete webhook subscription',
        description: `Remove a webhook subscription. No more events will be delivered to that URL. Safe to call even if already deleted (idempotent).`,
        operationId: 'deleteWebhook',
        tags: ['Webhooks'],
        parameters: [
          {
            name: 'subscriptionId',
            in: 'path',
            required: true,
            description: `UUID of webhook subscription to delete. Get from POST /api/webhooks response or GET /api/webhooks list.`,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: `Success: Webhook deleted.`,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { success: { type: 'boolean', enum: [true] } },
                },
              },
            },
          },
        },
      },
    },
    '/api/webhooks/test': {
      post: {
        summary: 'Test webhook delivery',
        description: `Send a test payload to a webhook subscription to verify it is set up correctly and receiving events. Use this to debug webhook issues. If test fails, check: (1) URL is reachable and HTTPS, (2) your server is not blocking requests, (3) you are responding with 2xx status code.`,
        operationId: 'testWebhook',
        tags: ['Webhooks'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['subscriptionId'],
                properties: {
                  subscriptionId: {
                    type: 'string',
                    format: 'uuid',
                    description: `UUID of webhook subscription to test.`
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: `Success: Test payload delivered (or delivery failed if delivered=false). Check responseCode to see what your endpoint returned. Common: 200-299 = success, 4xx = your endpoint error, 5xx = server error, timeout = endpoint unreachable.`,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', description: `True if test delivery succeeded (got 2xx response from your endpoint).` },
                    data: {
                      type: 'object',
                      properties: {
                        delivered: { type: 'boolean', description: `Whether payload was delivered (true) or failed to reach endpoint (false).` },
                        responseCode: { type: 'integer', description: `HTTP status code your endpoint returned (200 = success, 4xx = your error, 5xx = server error, timeout = -1).` },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // =====================
    // DATA EXPORT
    // =====================
    '/api/export': {
      get: {
        summary: 'Export data as CSV/JSON',
        description: `Export watchlist or trending tokens as CSV or JSON file for external analysis. WHEN TO USE: (1) Import to spreadsheet for analysis, (2) backup of watchlist, (3) reporting/compliance. Requires PRO subscription ($199+). QUOTA COST: 0 (free, not counted against API quota). FORMATS: CSV (spreadsheet-friendly) or JSON (programmatic import). DATASETS: (1) watchlist = your saved tokens with current metrics, (2) tokens = current trending tokens.`,
        operationId: 'exportData',
        tags: ['Account'],
        parameters: [
          {
            name: 'type',
            in: 'query',
            description: `Which dataset to export. watchlist = your personal saved tokens (current metrics). tokens = current trending tokens.`,
            schema: { type: 'string', enum: ['watchlist', 'tokens'], default: 'watchlist' },
          },
          {
            name: 'format',
            in: 'query',
            description: `Output format. csv = comma-separated values (open in Excel). json = JSON array of objects (parse with JSON.parse).`,
            schema: { type: 'string', enum: ['csv', 'json'], default: 'csv' },
          },
        ],
        responses: {
          '200': {
            description: `Success: File download. Browser downloads CSV or JSON file with filename "nullcheck-export-[date].[format]".`,
            content: {
              'text/csv': { schema: { type: 'string', format: 'binary' } },
              'application/json': { schema: { type: 'object' } },
            },
          },
          '403': {
            description: `PRO subscription required. Upgrade at nullcheck.io/pricing.`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },

    // =====================
    // API KEY MANAGEMENT
    // =====================
    '/api/keys': {
      get: {
        summary: 'List API keys',
        description: `Get all API keys for this account. Shows tier, creation date, last used, and limits. Key values are masked (only preview shown like "nk_abcd****XXXX") for security. WHEN TO USE: (1) Verify key exists, (2) check last usage to find unused keys (can delete to clean up), (3) see tier of each key. IMPORTANT: Seeing key preview is not enough to use it; you must have saved the full key when created.`,
        operationId: 'listApiKeys',
        tags: ['Account'],
        responses: {
          '200': {
            description: `Success: Array of API keys with id, preview (masked), tier, requests today, requests remaining, createdAt, lastUsedAt.`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiKeysListResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        summary: 'Create new API key',
        description: `Generate a new API key for bot/agent use. Key is returned ONLY in this response — save it immediately in secure location (env variable, key manager, encrypted file). You will NOT be able to see it again. After creation, you can only see preview (masked). TIER REQUIREMENTS: Must have active agent subscription (Developer $49/month or higher). Web users (human free tier) cannot create API keys. KEY FORMAT: "nk_" prefix + 32 alphanumeric characters. Example: "nk_abcdef1234567890abcdef1234567890". USAGE: Include in X-API-Key header for all API requests. SECURITY: Rotate keys periodically (create new, test, then delete old). If leaked, revoke immediately to stop unauthorized use.

STORAGE RECOMMENDATIONS:
- Environment variable (process.env.NULLCHECK_API_KEY)
- Secret manager (AWS Secrets Manager, HashiCorp Vault, etc)
- Encrypted config file (never version control)
- DO NOT: hardcode in source, commit to git, send in email, share with others`,
        operationId: 'createApiKey',
        tags: ['Account'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description: `Friendly name for key (optional). Examples: "discord-bot", "trading-bot-v2", "monitoring-agent". Use names to track which key is used where.`
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: `Success: API key created. CRITICAL: apiKey field contains full key. Save immediately — it will not be shown again. After leaving this page, you can only see masked preview.`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiKeyCreateResponse' },
              },
            },
          },
          '403': {
            description: `Agent subscription required. Only Developer tier ($49+) and higher can create API keys. Web/free users cannot.`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      delete: {
        summary: 'Revoke API key',
        description: `Permanently revoke an API key, rendering it useless immediately. Use for: (1) rotating keys (create new, revoke old), (2) decommissioning a bot, (3) if key is compromised. Revocation is instant — key stops working immediately. No grace period. Use with caution.`,
        operationId: 'revokeApiKey',
        tags: ['Account'],
        parameters: [
          {
            name: 'id',
            in: 'query',
            required: true,
            description: `API key ID to revoke. Get from GET /api/keys response. NOTE: This is the key ID (UUID), not the key value.`,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: `Success: Key revoked and useless immediately.`,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { success: { type: 'boolean', enum: [true] } },
                },
              },
            },
          },
        },
      },
    },

    // =====================
    // SUBSCRIPTION & USAGE
    // =====================
    '/api/subscription': {
      get: {
        summary: 'Get subscription status',
        description: `Check current subscription tier, limits, and status. Works for both human sessions and agent API keys. Returns: tier name (Developer/Professional/Business/Enterprise), daily request limit, remaining quota, webhook limits, batch size limits, feature flags. WHEN TO USE: (1) Before API calls to check you are on right tier, (2) after upgrade to confirm tier changed, (3) to determine how many requests you have left today. RATE RESET: Daily quota resets at midnight UTC. Limits are: Developer (333/day = ~14/hour), Professional (3333/day = ~139/hour), Business (10000/day = ~417/hour), Enterprise (custom). RELATIONSHIP TO /api/usage: /api/subscription tells you YOUR limits (what tier allows); /api/usage tells you YOUR CURRENT consumption (how many left today).`,
        operationId: 'getSubscription',
        tags: ['Account'],
        responses: {
          '200': {
            description: `Success: Subscription details with tier name, daily limit, batch limits, webhook limits, remaining quota for today.`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SubscriptionResponse' },
              },
            },
          },
        },
      },
    },
    '/api/usage': {
      get: {
        summary: 'Get API usage stats',
        description: `Check how many requests you have left today. Returns total quota, used today, remaining, and time until reset. WHEN TO USE: (1) Before making large batch request (check you have enough quota), (2) daily monitoring (detect over-usage), (3) planning batch size (if remaining < 100, reduce batch from 50 to 20). RESET TIME: Daily limits reset at midnight UTC (00:00:00 UTC). Calculate hours remaining with: (24 - hour_utc) * 60 - minute_utc minutes. OVERAGE BEHAVIOR: If you exceed daily limit, you get 429 Too Many Requests. Quota does NOT roll over; it resets daily. No refunds for over-usage. COST: This endpoint call costs 1 quota unit (so checking usage costs 1 request toward your limit).`,
        operationId: 'getUsage',
        tags: ['Account'],
        responses: {
          '200': {
            description: `Success: Usage stats with daily limit, requests used, remaining, and reset time (ISO 8601 timestamp).`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UsageResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // =====================
    // SYSTEM STATUS
    // =====================
    '/api/health': {
      get: {
        summary: 'Health check / API status',
        description: `Check if API is operational. No authentication required. Use to: (1) verify service is up before critical requests, (2) load test (simple endpoint to test connectivity), (3) monitoring/alerting (call every 5 minutes, alert if status != ok). Returns API version and timestamp. Very fast response (< 50ms under normal load). If this endpoint times out or returns non-200, API is down or experiencing issues.`,
        operationId: 'healthCheck',
        tags: ['System'],
        security: [],
        responses: {
          '200': {
            description: `Success: API is healthy. status='ok', version shows API version, timestamp is server time.`,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok'], description: `API operational status. ok = all systems healthy.` },
                    version: { type: 'string', description: `API version (e.g., 1.0.0).` },
                    timestamp: { type: 'string', format: 'date-time', description: `Server current time (ISO 8601 UTC).` },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  // =====================
  // COMPONENT SCHEMAS & REUSABLE DEFINITIONS
  // =====================
  components: {
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: `API key for bot/agent authentication. REQUIRED for all endpoints except /api/health. FORMAT: "nk_" followed by 32 alphanumeric characters. Example: "nk_abcdef123456789abcdef123456789012". Create keys at nullcheck.io/pricing (requires active agent subscription: Developer $49/month+). Each request must include header: "X-API-Key: nk_your_key_here". Keys are account-specific and cannot be shared. Compromised keys should be revoked immediately from /api/keys endpoint.`,
      },
    },
    responses: {
      BadRequest: {
        description: `Invalid request format or parameters. CAUSES: (1) malformed JSON body, (2) missing required field, (3) invalid address format (not 0x... for EVM or base58 for Solana), (4) invalid chain value (not ethereum/base/solana), (5) out-of-range values (limit > 100, negative number), (6) too many tokens in batch for your tier. FIX: Check error message in response for specific field that failed.`,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      Unauthorized: {
        description: `Authentication failed. CAUSES: (1) X-API-Key header missing, (2) API key invalid/revoked, (3) API key expired (contact support for renewal), (4) wrong key for account (keys are not shared). FIX: Verify key value, check not revoked at /api/keys, confirm key is for the same account.`,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      NotFound: {
        description: `Resource not found. CAUSES: (1) token does not exist on specified chain, (2) address format incorrect, (3) token has 0 holders/volume (contract exists but never used). FIX: Verify address exactly (use Etherscan/Solscan), confirm chain is correct, try searching /api/search if uncertain.`,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      RateLimited: {
        description: `Rate limit exceeded. CAUSES: Exceeded daily quota for API tier. LIMITS: Developer (333/day), Professional (3,333/day), Business (10,000/day). FIX: (1) Wait until midnight UTC for quota reset, (2) reduce batch size, (3) use caching to avoid duplicate requests, (4) upgrade tier at nullcheck.io/pricing. RETRY: Implement exponential backoff: wait 1s, retry; if fails wait 2s, retry; etc. Max retry 8 times.`,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
    schemas: {
      // === Error Response ===
      Error: {
        type: 'object',
        description: `Error response. FIELDS: code = machine-readable error code (e.g., INVALID_ADDRESS, RATE_LIMITED, SUBSCRIPTION_REQUIRED), message = human-readable explanation, details = optional field-level errors for 400 responses.`,
        properties: {
          code: { type: 'string', description: `Machine-readable error code. Examples: INVALID_ADDRESS, TOKEN_NOT_FOUND, RATE_LIMITED, UNAUTHORIZED, SUBSCRIPTION_REQUIRED, INVALID_CHAIN, BATCH_TOO_LARGE.` },
          message: { type: 'string', description: `Human-readable error message explaining what went wrong and how to fix it.` },
          details: {
            type: 'object',
            description: `Optional detailed errors for specific fields (400 responses). Example: { address: "Not a valid Ethereum address", chain: "Must be ethereum, base, or solana" }`
          },
        },
      },

      // === Token Core ===
      Token: {
        type: 'object',
        description: `Token metadata. Basic info about a token without metrics. Used in search results and lists.`,
        properties: {
          address: { type: 'string', description: `Smart contract address on blockchain. Exact format depends on chain: Ethereum/Base = 0x..., Solana = base58.` },
          chainId: { type: 'string', enum: ['ethereum', 'base', 'solana'], description: `Blockchain where token is deployed.` },
          symbol: { type: 'string', description: `Token ticker symbol (4-10 characters typically). Examples: PEPE, USDC, SHIB. NOT unique (multiple tokens can have same symbol on different chains).` },
          name: { type: 'string', description: `Full token name (variable length). Examples: "Uniswap", "USDC Coin", "Shiba Inu".` },
          decimals: { type: 'integer', description: `Token precision. How many decimal places. Examples: 18 (most ERC-20), 6 (USDC), 8 (WBTC). Used to convert raw amount to human-readable: human_amount = raw_amount / (10^decimals).` },
          logoUrl: { type: 'string', nullable: true, description: `URL to token logo image (100x100px typically). May be null for new/unlisted tokens.` },
        },
      },
      TokenMetrics: {
        type: 'object',
        description: `Current market data for token. Price, volume, liquidity, transaction counts. Updated every 1-2 minutes during market hours.`,
        properties: {
          price: { type: 'number', description: `Current USD price per token. Examples: 1.23 (USDC), 0.000000456 (shitcoin). Use with decimals to understand value. Price includes bid-ask spread and may lag real-time by 1-2 minutes.` },
          priceChange1h: { type: 'number', description: `Price change percentage over last 1 hour. Range: -100 to +1000+. Examples: 5.5 = price up 5.5% in last hour, -10.2 = price down 10.2% in last hour. Use to detect momentum and volatility.` },
          priceChange24h: { type: 'number', description: `Price change percentage over last 24 hours. More stable than 1h. Examples: 50 = price doubled, -80 = price dropped 80% (rug pull in progress). Combined with risk score, big negative changes on newly analyzed tokens = rug pulls.` },
          volume24h: { type: 'number', description: `Total USD traded in last 24 hours across all DEXes. THRESHOLDS: < $10k = zero adoption, < $100k = low liquidity (bad execution), < $1M = low adoption overall, > $10M = well-established. Huge volume spikes (>5x normal) often precede rug pulls as scammers "hype" before exit.` },
          liquidity: { type: 'number', description: `Total USD in DEX liquidity pools. This is the pool depth for trades. CRITICAL FOR TRADING: < $1k = essentially untradeable, < $10k = trades will move price, < $50k = tight spreads and slippage, < $100k = order sizing is important (e.g., $50k order = 50% of liquidity), > $100k = reasonable for normal retail orders, > $1M = institutional grade. Formula: if you want to buy X tokens, expect slippage = (X * price / liquidity) * 50% roughly.` },
          marketCap: { type: 'number', nullable: true, description: `Market cap in USD = price * circulating supply. May be null if supply is unknown or token is new. INTERPRETATION: < $1M = very small/new, $1M-$100M = small cap (more volatile), $100M-$1B = mid cap, > $1B = large cap (more stable). Always check if marketCap > 10x liquidity (suspicious; may indicate fake marketCap due to unlisted supply).` },
          txns24h: { type: 'integer', description: `Total number of buy+sell transactions in 24h. Indicates activity/adoption. < 100 = very low, 100-1000 = low, 1000-10000 = normal, > 10000 = high adoption. Combined with volume: low txns + high volume = whales (few big trades). High txns + low volume = retail (many small trades).` },
          buys24h: { type: 'integer', description: `Number of buy transactions in 24h. Compare with sells: if buys > sells = accumulation (bullish), if sells > buys = distribution (bearish). During pump phases, buys >> sells until rug pull (then all sells).` },
          sells24h: { type: 'integer', description: `Number of sell transactions in 24h. Rising sell count before price drop = warning sign. Sudden spike = potential rug pull in progress.` },
        },
      },

      // === Risk Analysis ===
      RiskScore: {
        type: 'object',
        description: `Comprehensive risk assessment and decision framework. SCORING: totalScore 0-100 where 0=completely safe, 100=absolute scam. LEVEL MAPPING: 0-14=LOW (safe), 15-29=MEDIUM (caution), 30-49=HIGH (red flags), 50-100=CRITICAL (do not buy). SUB-SCORES: Each component (honeypot, contract, holders, liquidity) has own sub-score (0-X), combined via weighted formula (honeypot=50%, contract=30%, holders=15%, liquidity=5%). USAGE: Use totalScore for automated decision rules, use level for human-readable status, use component scores to understand WHERE the risk comes from, use warnings array for detailed investigation.`,
        properties: {
          totalScore: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description: `Weighted composite risk score 0-100. DECISION FRAMEWORK: (1) 0-14 (LOW) = generally safe to trade, still verify liquidity > $50k, (2) 15-29 (MEDIUM) = something is off, review warnings, position size < 5% portfolio, monitor price, (3) 30-49 (HIGH) = serious concerns, multiple red flags, avoid new positions, consider exiting if holding, (4) 50-100 (CRITICAL) = almost certainly scam/honeypot, sell if holding, never buy. Do NOT override warnings (if honeypot=true or isHoneypot=true anywhere in response, DO NOT buy under any circumstances).`
          },
          level: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: `Human-readable risk level derived from totalScore. low (0-14), medium (15-29), high (30-49), critical (50-100).`
          },
          liquidity: { $ref: '#/components/schemas/LiquidityRisk' },
          holders: { $ref: '#/components/schemas/HolderRisk' },
          contract: { $ref: '#/components/schemas/ContractRisk' },
          honeypot: { $ref: '#/components/schemas/HoneypotRisk' },
          warnings: {
            type: 'array',
            description: `Array of specific risk warnings found. Each warning has code (machine-readable), severity (low/medium/high/critical), and message (human explanation). Review all high/critical severity warnings.`,
            items: { $ref: '#/components/schemas/RiskWarning' },
          },
          analyzedAt: {
            type: 'string',
            format: 'date-time',
            description: `ISO 8601 timestamp when analysis was performed. Use to determine if score is stale. If > 1 hour old and token price changed significantly, consider re-analyzing with force=true.`
          },
        },
      },
      LiquidityRisk: {
        type: 'object',
        description: `Liquidity pool health assessment. Low or unstable liquidity means your trades will have bad execution (high slippage, price impact, wide spreads). Unlocked LP tokens mean liquidity can be suddenly removed.`,
        properties: {
          score: { type: 'integer', description: `Liquidity risk sub-score 0-5 (lowest weight in total). Higher = worse. 0 = excellent liquidity, 5 = illiquid/risk.` },
          liquidity: { type: 'number', description: `Total liquidity in USD across all DEX pools combined. Used to calculate potential slippage on trades. Below $10k = risky, $10-50k = tight, $50-100k = reasonable, > $100k = healthy.` },
          lpLocked: { type: 'boolean', description: `Whether LP (liquidity provider) tokens are locked in contract, preventing removal. TRUE = good (LP cannot be rug pulled). FALSE = bad (can be removed anytime, price crashes). Check lpLockedPercent to see how much is locked.` },
          lpLockedPercent: { type: 'number', description: `Percentage of LP tokens that are locked (0-100). INTERPRETATION: 0% = 100% of LP can be removed (maximum rug risk), 50% = half locked half unlocked (moderate risk), 100% = all locked (best case, no rug risk from LP removal). If lpLockedPercent < 100%, liquidity is at risk.` },
        },
      },
      HolderRisk: {
        type: 'object',
        description: `Token distribution and holder concentration analysis. High concentration = rug pull risk. If few wallets own all tokens, they can dump and crash price.`,
        properties: {
          score: { type: 'integer', description: `Holder concentration risk sub-score 0-15. Higher = more concentrated = worse. 0 = well distributed, 15 = extreme concentration.` },
          totalHolders: { type: 'integer', description: `Total unique wallet addresses holding this token. THRESHOLDS: < 50 = suspicious (most tokens have 100+), 50-500 = low adoption, 500-5000 = decent, > 5000 = well distributed. New tokens can have low counts; don't use this alone.` },
          top10Percent: { type: 'number', description: `Percentage of total token supply owned by top 10 wallets (0-100). CRITICAL THRESHOLD: < 30% = good distribution, 30-50% = moderate concentration (watchful), 50-70% = high concentration (red flag), > 70% = extreme (founders/VCs own majority, rug pull risk very high). If top10 owns 80%, they can crash price anytime.` },
          creatorHoldingPercent: { type: 'number', description: `Percentage of supply held by token creator/deployer. INTERPRETATION: 0% = creator dumped all (may already be done rugging), 5% = mostly released, 10%+ = creator still heavily vested (possible dump risk), > 50% = creator owns majority (extreme rug pull risk). Combine with price history: if creator holding was 50% six months ago and is now 5%, means they sold into retail (possible scam pattern).` },
        },
      },
      ContractRisk: {
        type: 'object',
        description: `Smart contract code and control analysis. Unverified code, open minting, and unrenounced ownership are red flags. Verified code limits scam potential (code is public).`,
        properties: {
          score: { type: 'integer', description: `Contract risk sub-score 0-30 (second-highest weight). Higher = more concerning. 0 = perfect (verified, renounced, no mints), 30 = dangerous (unverified, unrenounced, can mint).` },
          verified: { type: 'boolean', description: `Whether contract source code is verified on blockchain explorer (Etherscan, Basescan, Solscan). TRUE = code is public and can be audited. FALSE = code is hidden (major red flag; could contain backdoors, rug functions, anything). Scammers hide code.` },
          renounced: { type: 'boolean', description: `Whether contract ownership has been renounced (owner address set to zero address). TRUE = owner cannot change contract rules anymore (code is locked). FALSE = owner still has admin keys and can change rules anytime (rug pull risk). Owners often claim "ownership renounced" but don't actually do it; check blockchain explorer to verify.` },
          hasMintFunction: { type: 'boolean', description: `Whether contract can mint new tokens (print supply). TRUE = contract owner can print infinite tokens and dump on holders (rug pull). FALSE = fixed supply, cannot be inflated. Check if mint is pausable (can be disabled) or permanent.` },
          maxTaxPercent: { type: 'number', description: `Maximum buy/sell tax percentage (0-100). INTERPRETATION: 0-2% = normal/none, 2-5% = moderate (some DeFi protocols do this for buyback), 5-10% = suspicious/high fees, 10-25% = scam (taxes go to owner), > 25% = definite scam (user gets 75% less tokens than they pay for, 25% cut to owner). Always check if tax can be modified (changeable = more risk).` },
        },
      },
      HoneypotRisk: {
        type: 'object',
        description: `HIGHEST WEIGHT RISK (50% of total score). Honeypot = token you can buy but CANNOT SELL. Your money is trapped. The most critical check.`,
        properties: {
          score: { type: 'integer', description: `Honeypot risk sub-score 0-50 (HIGHEST WEIGHT, 50% of total score). If this score is high, total score becomes critical. 0 = not honeypot, 50 = definite honeypot.` },
          isHoneypot: { type: 'boolean', description: `BOOLEAN: TRUE = you CANNOT sell this token. Do not buy under any circumstances. FALSE = selling is allowed (you can exit position). This is the most critical field in the entire response. If true, totalScore automatically becomes 50+ (CRITICAL).` },
          buyTax: { type: 'number', description: `Tax percentage applied when buying token (0-100). Examples: 0% = no tax, 5% = pay $100 but get tokens worth $95, 50% = pay $100 but get $50 worth of tokens. Normal tokens have 0-2%. Above 5% is suspicious.` },
          sellTax: { type: 'number', description: `Tax percentage applied when selling token (0-100). CRITICAL: If sellTax is 100%, selling is forbidden (honeypot). If sellTax is 50%, selling gives you 50% less than market value (extremely bad). If sellTax is much higher than buyTax (e.g., buy=1%, sell=50%), it's a honeypot or rug. Normal tokens have 0-2% sell tax.` },
          cannotSell: { type: 'boolean', description: `Whether selling is technically impossible (blocked at contract level). TRUE = honeypot, cannot exit. FALSE = selling should work (but may have high tax). If cannotSell=true, do not buy.` },
        },
      },
      RiskWarning: {
        type: 'object',
        description: `Specific risk finding with severity level. Review all high/critical warnings before trading.`,
        properties: {
          code: {
            type: 'string',
            description: `Machine-readable warning code for automated filtering. Examples: high_holder_concentration, unverified_contract, unrenounced_ownership, high_sell_tax, honeypot_detected, low_liquidity, high_price_volatility, creator_holding, mint_enabled.`
          },
          severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: `Severity level. low = minor concern (can ignore), medium = noteworthy (review), high = significant issue (do not invest new money), critical = deal-breaker (sell or never buy).`
          },
          message: {
            type: 'string',
            description: `Human-readable explanation of the warning. Examples: "Top 10 holders own 75% of supply (extreme concentration)", "Contract source code is not verified on Etherscan", "Selling disabled (honeypot detected)".`
          },
        },
      },

      // === Whale Activity ===
      WhaleTransaction: {
        type: 'object',
        description: `Single large wallet transaction (buy or sell). Whales trading in volume often precedes price moves.`,
        properties: {
          txHash: { type: 'string', description: `Transaction hash on blockchain. Use to look up on Etherscan/Solscan to verify details.` },
          type: { type: 'string', enum: ['buy', 'sell'], description: `Whether whale bought or sold tokens.` },
          tokenAddress: { type: 'string', description: `Token contract address (included for context).` },
          chainId: { type: 'string', description: `Blockchain (ethereum/base/solana).` },
          walletAddress: { type: 'string', description: `Whale wallet address. If labeled, appears in tooltip on web; here is raw address.` },
          amount: { type: 'number', description: `Token amount transacted (raw, need to divide by 10^decimals for human-readable).` },
          valueUsd: { type: 'number', description: `USD value of transaction at time of execution. Large values (> $100k) indicate serious money moving.` },
          timestamp: { type: 'integer', description: `Unix timestamp (seconds since epoch) when transaction executed. Use to determine recency.` },
          priceAtTx: { type: 'number', description: `Token price at time of transaction (USD). Compare with current price to see if whale is underwater (bought high) or in profit (bought low).` },
        },
      },
      WhaleActivity: {
        type: 'object',
        description: `Summary of large wallet activity in 24h window. Aggregate metrics for whale sentiment. Positive netFlow = accumulation (bullish), negative = distribution (bearish).`,
        properties: {
          count24h: { type: 'integer', description: `Total whale transactions in 24h (buys + sells combined).` },
          buyCount24h: { type: 'integer', description: `Number of whale buy transactions. High buys = accumulation signal.` },
          sellCount24h: { type: 'integer', description: `Number of whale sell transactions. High sells = distribution signal.` },
          netFlow24h: { type: 'integer', description: `Buy count minus sell count. Positive = more buys than sells (accumulation, bullish). Negative = more sells than buys (distribution, bearish). Example: 5 buys, 2 sells = netFlow = +3 (bullish). Use with risk.level: if risk is high and netFlow is negative, get out.` },
          largestTx: { $ref: '#/components/schemas/WhaleTransaction', description: `The single largest transaction (by USD value) in 24h. Shows max whale buying/selling power.` },
          recentTransactions: {
            type: 'array',
            description: `Last 10 whale transactions, most recent first. Review to understand whale intent and timing.`,
            items: { $ref: '#/components/schemas/WhaleTransaction' },
          },
        },
      },
      TokenHolder: {
        type: 'object',
        description: `Single holder in distribution list. Wallet address, balance, percentage of supply, and contract/lock flags.`,
        properties: {
          address: { type: 'string', description: `Holder wallet address (Ethereum) or public key (Solana). Use this to look up on Etherscan/Solscan.` },
          balance: { type: 'string', description: `Token balance as string (for precision with very large/small numbers). Divide by 10^decimals to get human-readable amount.` },
          percent: { type: 'number', description: `Percentage of total supply held by this wallet (0-100). Sum of top 10 = top10Percent risk metric.` },
          isContract: { type: 'boolean', description: `Whether this address is a smart contract. TRUE = likely DEX, vault, bridge, or protocol (cannot easily dump). FALSE = regular wallet (could be person, DAO, founder).` },
          isLocked: { type: 'boolean', description: `Whether tokens are locked (cannot be immediately transferred). TRUE = good (cannot rug pull until lock expires). FALSE = can be sold immediately (rug risk).` },
          tag: { type: 'string', nullable: true, description: `Label if address is known. Examples: "Uniswap", "WETH", "Burn", "Team Vesting", "LP Lock". Helps identify contract type/purpose.` },
        },
      },

      // === Alerts ===
      PriceAlert: {
        type: 'object',
        description: `Price alert trigger condition and status. Fires when token price reaches target.`,
        properties: {
          id: { type: 'string', format: 'uuid', description: `Unique alert identifier. Use for deleting alert.` },
          chainId: { type: 'string', description: `Blockchain.` },
          tokenAddress: { type: 'string', description: `Token contract address.` },
          tokenSymbol: { type: 'string', description: `Token ticker symbol.` },
          tokenName: { type: 'string', nullable: true, description: `Full token name if available.` },
          alertType: { type: 'string', enum: ['price_above', 'price_below'], description: `Trigger condition. price_above = alert fires when current >= target. price_below = alert fires when current <= target.` },
          targetPrice: { type: 'number', description: `Target price in USD. Alert fires when current price reaches this.` },
          createdPrice: { type: 'number', description: `Token price at time alert was created. Useful for context (how far down/up is target from creation price).` },
          isTriggered: { type: 'boolean', description: `Whether alert has fired. TRUE = condition was met at least once.` },
          triggeredAt: { type: 'string', format: 'date-time', nullable: true, description: `Timestamp when alert fired (if triggered).` },
          triggeredPrice: { type: 'number', nullable: true, description: `Price at which alert fired (if triggered).` },
          notificationSent: { type: 'boolean', description: `Whether notification was sent to user. TRUE = email/webhook sent. FALSE = alert fired but user not notified (should never happen).` },
          createdAt: { type: 'string', format: 'date-time', description: `When alert was created.` },
        },
      },

      // === Responses ===
      TokensResponse: {
        type: 'object',
        description: `Response from GET /api/tokens (trending tokens list).`,
        properties: {
          data: {
            type: 'object',
            properties: {
              tokens: {
                type: 'array',
                items: {
                  allOf: [
                    { $ref: '#/components/schemas/Token' },
                    { $ref: '#/components/schemas/TokenMetrics' },
                    {
                      type: 'object',
                      properties: {
                        risk: { $ref: '#/components/schemas/RiskScore', nullable: true, description: `Optional risk score if token was previously analyzed. Null if never analyzed.` },
                      },
                    },
                  ],
                },
              },
            },
          },
          metadata: {
            type: 'object',
            properties: {
              cached: { type: 'boolean', description: `Whether results are from cache (true) or fresh (false).` },
              cacheAge: { type: 'integer', description: `Age of cache in seconds (0-30). If > 30, data may be stale.` },
            },
          },
        },
      },
      TokenDetailResponse: {
        type: 'object',
        description: `Response from GET /api/token/{chain}/{address} (single token details).`,
        properties: {
          data: {
            allOf: [
              { $ref: '#/components/schemas/Token' },
              { $ref: '#/components/schemas/TokenMetrics' },
              {
                type: 'object',
                properties: {
                  risk: { $ref: '#/components/schemas/RiskScore', nullable: true, description: `Cached risk score if exists, null otherwise.` },
                  holders: { type: 'integer', description: `Total unique holder count.` },
                },
              },
            ],
          },
          metadata: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      SearchResponse: {
        type: 'object',
        description: `Response from GET /api/search (token search results).`,
        properties: {
          data: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: { $ref: '#/components/schemas/Token' },
              },
            },
          },
          metadata: {
            type: 'object',
            properties: {
              matched: { type: 'boolean', description: `Whether search returned any results.` },
            },
          },
        },
      },
      RiskResponse: {
        type: 'object',
        description: `Response from POST /api/risk/{chain}/{address} (risk analysis).`,
        properties: {
          data: { $ref: '#/components/schemas/RiskScore' },
          metadata: {
            type: 'object',
            properties: {
              requestId: { type: 'string', description: `Unique request identifier for debugging.` },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      BatchRiskResponse: {
        type: 'object',
        description: `Response from POST /api/risk/batch (batch risk analysis).`,
        properties: {
          data: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  allOf: [
                    { $ref: '#/components/schemas/RiskScore' },
                    {
                      type: 'object',
                      properties: {
                        address: { type: 'string' },
                        chainId: { type: 'string' },
                        error: { type: 'string', nullable: true, description: `If token analysis failed, error message. Null if successful.` },
                      },
                    },
                  ],
                },
              },
            },
          },
          metadata: {
            type: 'object',
            properties: {
              analyzed: { type: 'integer', description: `Number of fresh analyses performed (time-consuming).` },
              cached: { type: 'integer', description: `Number of cached results returned (instant).` },
              totalTime: { type: 'integer', description: `Total time in milliseconds for entire batch.` },
            },
          },
        },
      },
      HoldersResponse: {
        type: 'object',
        description: `Response from GET /api/holders/{chain}/{address} (token holder list).`,
        properties: {
          data: {
            type: 'object',
            properties: {
              holders: {
                type: 'array',
                items: { $ref: '#/components/schemas/TokenHolder' },
              },
            },
          },
          metadata: {
            type: 'object',
            properties: {
              totalHolders: { type: 'integer', description: `Total holder count across all addresses (may be > limit returned).` },
              top10Percent: { type: 'number', description: `Percentage of supply owned by top 10 holders (from holders response).` },
            },
          },
        },
      },
      AlertsListResponse: {
        type: 'object',
        description: `Response from GET /api/alerts (list price alerts).`,
        properties: {
          data: {
            type: 'object',
            properties: {
              alerts: {
                type: 'array',
                items: { $ref: '#/components/schemas/PriceAlert' },
              },
            },
          },
        },
      },
      WatchlistResponse: {
        type: 'object',
        description: `Response from GET /api/watchlist (basic watchlist).`,
        properties: {
          data: {
            type: 'object',
            properties: {
              tokens: {
                type: 'array',
                items: { $ref: '#/components/schemas/Token' },
              },
            },
          },
          metadata: {
            type: 'object',
            properties: {
              count: { type: 'integer', description: `Number of tokens in watchlist.` },
            },
          },
        },
      },
      WatchlistTokensResponse: {
        type: 'object',
        description: `Response from GET /api/watchlist/tokens (watchlist with metrics and risk).`,
        properties: {
          data: {
            type: 'object',
            properties: {
              tokens: {
                type: 'array',
                items: {
                  allOf: [
                    { $ref: '#/components/schemas/Token' },
                    { $ref: '#/components/schemas/TokenMetrics' },
                    {
                      type: 'object',
                      properties: {
                        risk: { $ref: '#/components/schemas/RiskScore', nullable: true },
                      },
                    },
                  ],
                },
              },
            },
          },
          metadata: {
            type: 'object',
            properties: {
              count: { type: 'integer' },
            },
          },
        },
      },
      WebhookCreateRequest: {
        type: 'object',
        description: `Request body for POST /api/webhooks (create webhook subscription).`,
        required: ['url', 'events'],
        properties: {
          url: {
            type: 'string',
            format: 'uri',
            description: `HTTPS endpoint URL where webhook payloads will be POSTed. Must be publicly accessible, use HTTPS (not HTTP), and respond with 2xx status within 30 seconds. Example: https://mybot.example.com/webhooks/nullcheck.`
          },
          events: {
            type: 'array',
            description: `Array of event types to subscribe to. Can include any combination: risk.high, risk.critical, risk.honeypot, whale.buy, whale.sell, price.increase, price.decrease. You receive notifications for ANY matching event.`,
            items: {
              type: 'string',
              enum: ['risk.high', 'risk.critical', 'risk.honeypot', 'whale.buy', 'whale.sell', 'price.increase', 'price.decrease'],
            },
          },
          tokenFilters: {
            type: 'array',
            description: `OPTIONAL. If provided, only send events for tokens in this list (address + chainId). If omitted, send events for ALL tokens (verbose). Use to focus on key holdings.`,
            items: {
              type: 'object',
              properties: {
                address: { type: 'string' },
                chainId: { type: 'string' },
              },
            },
          },
        },
      },
      WebhookResponse: {
        type: 'object',
        description: `Response from POST /api/webhooks (webhook subscription created).`,
        properties: {
          data: {
            type: 'object',
            properties: {
              subscriptionId: { type: 'string', format: 'uuid', description: `Unique webhook subscription ID. Save for later delete/test operations.` },
              url: { type: 'string', description: `Webhook URL (exact match to request).` },
              events: { type: 'array', items: { type: 'string' }, description: `Subscribed event types.` },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      WebhooksListResponse: {
        type: 'object',
        description: `Response from GET /api/webhooks (list webhooks).`,
        properties: {
          data: {
            type: 'object',
            properties: {
              webhooks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    subscriptionId: { type: 'string', format: 'uuid' },
                    url: { type: 'string' },
                    events: { type: 'array', items: { type: 'string' } },
                    active: { type: 'boolean', description: `Whether webhook is active (true) or disabled (false).` },
                    lastDelivery: { type: 'string', format: 'date-time', nullable: true, description: `Timestamp of last successful delivery.` },
                    createdAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
      ApiKeyCreateResponse: {
        type: 'object',
        description: `Response from POST /api/keys (create API key). CRITICAL: Save apiKey field immediately.`,
        properties: {
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', description: `Unique key ID (UUID). Use for revocation.` },
              apiKey: { type: 'string', description: `FULL API KEY VALUE (only shown once). Format: nk_[32 chars]. Save securely in environment variable or key manager.` },
              name: { type: 'string', description: `Friendly name you provided (or auto-generated).` },
              tier: { type: 'string', description: `Subscription tier (Developer, Professional, Business, Enterprise).` },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      ApiKeysListResponse: {
        type: 'object',
        description: `Response from GET /api/keys (list API keys).`,
        properties: {
          data: {
            type: 'object',
            properties: {
              keys: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    preview: { type: 'string', description: `Masked key preview (e.g., nk_abcd****XY12). Not usable, just for identification.` },
                    name: { type: 'string' },
                    tier: { type: 'string' },
                    requestsToday: { type: 'integer', description: `Requests made with this key today.` },
                    requestsRemaining: { type: 'integer', description: `Requests remaining before rate limit.` },
                    createdAt: { type: 'string', format: 'date-time' },
                    lastUsedAt: { type: 'string', format: 'date-time', nullable: true, description: `When this key was last used (null if never).` },
                  },
                },
              },
            },
          },
        },
      },
      SubscriptionResponse: {
        type: 'object',
        description: `Response from GET /api/subscription (current subscription tier and limits).`,
        properties: {
          data: {
            type: 'object',
            properties: {
              tier: { type: 'string', description: `Current tier: Developer, Professional, Business, or Enterprise.` },
              dailyLimit: { type: 'integer', description: `Maximum requests per day for this tier.` },
              batchLimit: { type: 'integer', description: `Maximum tokens in single batch request.` },
              webhookLimit: { type: 'integer', description: `Maximum active webhooks (or -1 for unlimited).` },
              features: {
                type: 'object',
                description: `Feature flags indicating what this tier can access.`,
                properties: {
                  whaleTracking: { type: 'boolean' },
                  webhooks: { type: 'boolean' },
                  dataExport: { type: 'boolean' },
                  prioritySupport: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
      UsageResponse: {
        type: 'object',
        description: `Response from GET /api/usage (current usage and quota).`,
        properties: {
          data: {
            type: 'object',
            properties: {
              dailyLimit: { type: 'integer', description: `Daily quota limit for this tier.` },
              requestsUsed: { type: 'integer', description: `Requests used today (resets at midnight UTC).` },
              requestsRemaining: { type: 'integer', description: `Requests available before rate limit.` },
              percentUsed: { type: 'number', description: `Percentage of daily quota consumed (0-100).` },
              resetsAt: { type: 'string', format: 'date-time', description: `ISO 8601 timestamp when daily quota resets (always midnight UTC).` },
            },
          },
        },
      },
    },
  },
};
