# null//check

**Risk-first DEX screener and agent-first API platform.**

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

---

## Table of Contents

- [Features](#features)
- [Risk Analysis](#risk-analysis)
- [Whale Tracking](#whale-tracking)
- [Multi-Chart Grid](#multi-chart-grid)
- [Watchlist](#watchlist)
- [Subscriptions](#subscriptions)
- [API Reference](#api-reference)
- [Webhooks](#webhooks)
- [Authentication & Security](#authentication--security)
- [Technical Architecture](#technical-architecture)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [External APIs](#external-apis)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Real-Time Token Table

The homepage displays trending tokens across all supported chains with live price updates via Server-Sent Events (SSE). Prices update every 5 seconds without page refresh.

**Displayed Metrics:**
- Token name, symbol, and logo
- Current price with 1h/24h/7d change percentages
- 24-hour trading volume
- Liquidity depth
- Market cap and fully diluted valuation (FDV)
- Holder count
- 24-hour transaction count (buys/sells)
- Risk score badge (color-coded)
- Whale activity indicator

**Filtering & Sorting:**
- Filter by chain (Ethereum, Base, Solana, Arbitrum, Polygon)
- Sort by any column (price, volume, liquidity, risk, etc.)
- Search by token name, symbol, or contract address

### Multi-Chain Support

| Chain | Chain ID | Explorer |
|-------|----------|----------|
| Ethereum | `ethereum` | etherscan.io |
| Base | `base` | basescan.org |
| Solana | `solana` | solscan.io |
| Arbitrum | `arbitrum` | arbiscan.io |
| Polygon | `polygon` | polygonscan.com |

All chains are displayed in a unified interface. Token addresses are normalized per chain (lowercase for EVM, case-sensitive for Solana).

### Token Detail Pages

Navigate to `/token/{chain}/{address}` for comprehensive token information:

- **Price Chart** — Interactive candlestick chart with multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d)
- **Token Metrics** — Full breakdown of price, volume, liquidity, market cap, holders
- **Risk Analysis** — Detailed risk panel with category breakdowns
- **Top Holders** — Largest wallet addresses with percentage ownership
- **Whale Activity** — Recent large transactions with buy/sell indicators
- **Pool Information** — DEX pools, liquidity providers, pair addresses

### Dark/Light Theme

Toggle between dark and light modes. Theme preference persists to localStorage and applies site-wide.

---

## Risk Analysis

Every token is analyzed across five risk vectors, producing a composite score from 0-100.

### Risk Levels

| Level | Score Range | Color | Interpretation |
|-------|-------------|-------|----------------|
| `LOW` | 0-14 | Green | Standard caution. Generally safe to trade. |
| `MEDIUM` | 15-29 | Yellow | Some concerns identified. Investigate further. |
| `HIGH` | 30-49 | Orange | Significant red flags. High probability of loss. |
| `CRITICAL` | 50-100 | Red | Likely scam or honeypot. Avoid entirely. |

### Risk Categories

#### 1. Honeypot Detection
Simulates buy and sell transactions to detect:
- Sell restrictions (can you actually sell?)
- Hidden transfer fees
- Anti-whale mechanisms that block large sells
- Time-locked selling restrictions

#### 2. Contract Analysis
Examines smart contract for dangerous functions:
- Proxy contracts (upgradeable code)
- Mint functions (can create unlimited tokens)
- Blacklist capabilities (can block addresses)
- Pause functions (can freeze all transfers)
- Hidden owner functions
- Self-destruct capability

#### 3. Holder Concentration
Analyzes token distribution:
- Top 10 holder percentage
- Creator wallet holdings
- Team wallet identification
- Concentration risk scoring

#### 4. Liquidity Risk
Evaluates trading safety:
- Total liquidity depth in USD
- Liquidity-to-market-cap ratio
- Time since pool deployment
- Number of liquidity providers

#### 5. LP Security
Checks liquidity provider token status:
- LP tokens burned (permanent liquidity)
- LP tokens locked (time-locked liquidity)
- Lock duration and unlock date
- Percentage of LP locked vs unlocked

### Risk Score Calculation

```typescript
totalScore = (
  honeypotScore * 0.35 +    // 35% weight - most critical
  contractScore * 0.25 +    // 25% weight
  holderScore * 0.20 +      // 20% weight
  liquidityScore * 0.15 +   // 15% weight
  lpSecurityScore * 0.05    // 5% weight
)
```

### Risk Warnings

Each risk category can generate specific warnings:

```typescript
// Example warnings
"Honeypot detected - sells will fail"
"Contract is a proxy - code can be changed"
"Top 10 holders control 85% of supply"
"Liquidity is only $5,000"
"LP tokens are not locked"
"Hidden mint function detected"
"Creator holds 45% of supply"
```

---

## Whale Tracking

Track large holder activity to understand smart money movements.

### Top Holders Panel

Displays the largest token holders with:
- Wallet address (truncated: `0x1234...5678`)
- Balance amount and percentage of total supply
- Visual percentage bar
- Contract indicator (is the wallet a contract?)
- Lock indicator (are tokens locked?)
- Tags: `DEX`, `Burn`, `Team`, `Locked`, `Contract`

### Whale Activity Feed

Real-time feed of large transactions:
- Transaction type: Buy (green) or Sell (red)
- Token amount and USD value
- Wallet address
- Time ago (e.g., "2h ago")
- Transaction hash (link to explorer)

### Whale Activity Badge

In the main token table, each token shows a whale activity indicator:
- Shows 24h whale transaction count
- Color-coded: Green (more buys), Red (more sells)
- Tooltip with buy/sell breakdown

### Whale Thresholds

```typescript
WHALE_THRESHOLDS = {
  minValueUsd: 10000,      // $10k minimum transaction value
  minSupplyPercent: 1,     // Or 1% of total supply
}
```

### Tier Limits

| Feature | Free | PRO |
|---------|------|-----|
| Top Holders Displayed | 5 wallets | 20 wallets |
| Whale Feed Items | 5 transactions | Unlimited |

---

## Multi-Chart Grid

View multiple token charts simultaneously at `/charts`.

### Chart Layouts

| Tier | Chart Slots |
|------|-------------|
| Free | 4 charts (2x2) |
| PRO | 16 charts (4x4) |

### Chart Features

Each chart includes:
- **OHLCV Candlesticks** — Open, High, Low, Close, Volume
- **Volume Histogram** — Below price chart
- **Timeframes** — 1m, 5m, 15m, 1h, 4h, 1d
- **Token Selector** — Search and add any token

### Chart Library

Built with [Lightweight Charts](https://github.com/nickovchinnikov/lightweight-charts) by TradingView for high-performance rendering.

---

## Watchlist

Save tokens for quick access at `/watchlist`.

### Features

- Star any token from the table or detail page
- Access watchlist from navigation menu
- Synced to your account across devices
- Remove tokens with one click

### Tier Limits

| Tier | Watchlist Tokens |
|------|------------------|
| Free | 10 tokens |
| PRO | Unlimited |

---

## Subscriptions

### Free Tier

Available to all users:
- View all tokens and risk scores
- Real-time price streaming
- Basic watchlist (10 tokens)
- Multi-chart grid (4 slots)
- Top 5 holders per token
- Last 5 whale transactions

### PRO Subscription

**$5/month** or **$39/year** (save 35%)

| Feature | Free | PRO |
|---------|------|-----|
| Watchlist Tokens | 10 | Unlimited |
| Chart Slots | 4 | 16 |
| Price Alerts | 3 | Unlimited |
| Top Holders | 5 | 20 |
| Whale Feed | 5 txns | Unlimited |
| API Access | No | Yes (Starter tier) |

### Payment Processing

Payments are handled by Stripe:
- Secure checkout
- Customer billing portal for subscription management
- Automatic renewal
- Cancel anytime (access continues until period end)

---

## API Reference

Programmatic access for AI agents, trading bots, and custom integrations.

### Base URL

```
Production: https://api.nullcheck.io
Development: http://localhost:3000
```

### Authentication

All API requests require authentication via API key:

```bash
# Header authentication (recommended)
curl -H "X-API-Key: nk_your_key_here" https://api.nullcheck.io/api/tokens

# Query parameter authentication
curl "https://api.nullcheck.io/api/tokens?api_key=nk_your_key_here"
```

API keys are generated from the `/keys` page (PRO subscription required).

### API Key Format

```
nk_[32 random alphanumeric characters]
Example: nk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

**Security:**
- Keys are hashed with SHA-256 before storage
- Only the key prefix (`nk_********...`) is displayed after creation
- Full key is shown only once at creation time
- Revoked keys cannot be recovered

### API Tiers

| Tier | Daily Limit | Batch Size | Overage | Price |
|------|-------------|------------|---------|-------|
| **Starter** | 10,000 | 10 tokens | Not available | Free with PRO |
| **Builder** | 100,000 | 50 tokens | $0.25/1,000 | $19/month |
| **Scale** | 1,000,000 | 100 tokens | $0.10/1,000 | $49/month |

### Rate Limiting

- Limits are tracked per API key per day
- Reset at midnight UTC
- Rate limit headers included in all responses:

```
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9542
X-RateLimit-Reset: 1705363200
```

- Overage headers (Builder/Scale only):

```
X-RateLimit-Overage: true
X-RateLimit-Overage-Count: 1523
X-RateLimit-Overage-Rate: $0.25/1000
```

### Response Format

All endpoints return consistent JSON:

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T12:00:00Z",
    "cached": false
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid token address format"
  },
  "meta": {
    "requestId": "req_abc123"
  }
}
```

### Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid parameters |
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 401 | `INVALID_KEY` | API key revoked or doesn't exist |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 429 | `RATE_LIMITED` | Daily limit exceeded |
| 500 | `INTERNAL_ERROR` | Server error |

---

### Endpoints

#### GET /api/tokens

List trending tokens with metrics and risk scores.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `chain` | string | all | Filter by chain ID |
| `limit` | number | 50 | Max tokens to return (1-100) |

**Response:**
```json
{
  "success": true,
  "data": {
    "tokens": [
      {
        "address": "0x...",
        "chainId": "ethereum",
        "symbol": "PEPE",
        "name": "Pepe",
        "decimals": 18,
        "logoUrl": "https://...",
        "metrics": {
          "price": 0.00001234,
          "priceChange1h": 2.5,
          "priceChange24h": -5.2,
          "priceChange7d": 15.8,
          "volume24h": 5000000,
          "liquidity": 2500000,
          "marketCap": 50000000,
          "fdv": 100000000,
          "holders": 15000,
          "txns24h": { "buys": 1200, "sells": 800 }
        },
        "risk": {
          "totalScore": 23,
          "level": "medium",
          "warnings": ["Top 10 holders control 65% of supply"]
        }
      }
    ]
  }
}
```

---

#### GET /api/token/{chain}/{address}

Get detailed token information.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `chain` | string | Chain ID (ethereum, base, solana, etc.) |
| `address` | string | Token contract address |

**Response:**
```json
{
  "success": true,
  "data": {
    "token": {
      "address": "0x...",
      "chainId": "ethereum",
      "symbol": "PEPE",
      "name": "Pepe",
      "decimals": 18,
      "logoUrl": "https://...",
      "totalSupply": "420690000000000"
    },
    "metrics": {
      "price": 0.00001234,
      "priceChange1h": 2.5,
      "priceChange24h": -5.2,
      "priceChange7d": 15.8,
      "volume24h": 5000000,
      "liquidity": 2500000,
      "marketCap": 50000000,
      "fdv": 100000000,
      "holders": 15000,
      "txns24h": { "buys": 1200, "sells": 800 }
    },
    "risk": { ... },
    "pools": [
      {
        "address": "0x...",
        "dex": "uniswap_v3",
        "baseToken": { ... },
        "quoteToken": { ... },
        "liquidity": 2500000
      }
    ]
  }
}
```

---

#### GET /api/risk/{chain}/{address}

Get risk analysis for a token.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `chain` | string | Chain ID |
| `address` | string | Token contract address |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `refresh` | boolean | false | Force fresh analysis (ignore cache) |

**Response:**
```json
{
  "success": true,
  "data": {
    "tokenAddress": "0x...",
    "chainId": "ethereum",
    "totalScore": 23,
    "level": "medium",
    "liquidity": {
      "score": 15,
      "warnings": ["Liquidity is below $100,000"]
    },
    "holders": {
      "score": 35,
      "warnings": ["Top 10 holders control 65% of supply"]
    },
    "contract": {
      "score": 10,
      "warnings": []
    },
    "honeypot": {
      "score": 0,
      "warnings": []
    },
    "warnings": [
      "Liquidity is below $100,000",
      "Top 10 holders control 65% of supply"
    ],
    "analyzedAt": "2024-01-15T12:00:00Z"
  }
}
```

---

#### POST /api/risk/batch

Analyze multiple tokens in a single request.

**Request Body:**
```json
{
  "tokens": [
    { "address": "0x...", "chainId": "ethereum" },
    { "address": "0x...", "chainId": "base" },
    { "address": "So1ana...", "chainId": "solana" }
  ]
}
```

**Batch Size Limits:**
| Tier | Max Tokens |
|------|------------|
| Starter | 10 |
| Builder | 50 |
| Scale | 100 |

**Response:**
```json
{
  "success": true,
  "data": {
    "results": {
      "ethereum-0x...": { "totalScore": 23, "level": "medium", ... },
      "base-0x...": { "totalScore": 8, "level": "low", ... },
      "solana-So1ana...": { "totalScore": 67, "level": "critical", ... }
    },
    "meta": {
      "requested": 3,
      "succeeded": 3,
      "failed": 0
    }
  }
}
```

---

#### POST /api/risk/batch-stream

Stream batch risk analysis results via Server-Sent Events.

**Request Body:**
```json
{
  "tokens": [
    { "address": "0x...", "chainId": "ethereum" },
    { "address": "0x...", "chainId": "base" }
  ]
}
```

**Response (SSE Stream):**
```
event: progress
data: {"completed": 1, "total": 2}

event: result
data: {"key": "ethereum-0x...", "risk": {...}}

event: result
data: {"key": "base-0x...", "risk": {...}}

event: done
data: {"succeeded": 2, "failed": 0, "duration": 1523}
```

---

#### GET /api/whale/holders/{chain}/{address}

Get top token holders.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `chain` | string | Chain ID |
| `address` | string | Token contract address |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | tier limit | Max holders (capped by subscription) |

**Response:**
```json
{
  "success": true,
  "data": {
    "holders": [
      {
        "address": "0x1234...5678",
        "balance": "1000000000000000000000",
        "percent": 15.5,
        "isContract": true,
        "isLocked": false,
        "tag": "DEX"
      },
      {
        "address": "0xdead...beef",
        "balance": "500000000000000000000",
        "percent": 8.2,
        "isContract": true,
        "isLocked": true,
        "tag": "Burn"
      }
    ],
    "totalHolders": 15000,
    "limit": 20
  }
}
```

---

#### GET /api/whale/activity/{chain}/{address}

Get whale transaction activity.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `chain` | string | Chain ID |
| `address` | string | Token contract address |

**Response:**
```json
{
  "success": true,
  "data": {
    "count24h": 45,
    "buyCount24h": 28,
    "sellCount24h": 17,
    "netFlow24h": 11,
    "largestTx": {
      "txHash": "0x...",
      "type": "buy",
      "walletAddress": "0x...",
      "amount": 5000000,
      "valueUsd": 125000,
      "timestamp": 1705320000
    },
    "recentTransactions": [
      {
        "txHash": "0x...",
        "type": "buy",
        "walletAddress": "0x...",
        "amount": 1000000,
        "valueUsd": 25000,
        "timestamp": 1705319000
      }
    ]
  }
}
```

---

#### GET /api/ohlcv/{chain}/{address}

Get OHLCV candlestick data for charting.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `chain` | string | Chain ID |
| `address` | string | Token contract address |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `interval` | string | `1h` | Candle interval: 1m, 5m, 15m, 1h, 4h, 1d |
| `limit` | number | 100 | Number of candles (max 500) |

**Response:**
```json
{
  "success": true,
  "data": {
    "ohlcv": [
      {
        "timestamp": 1705320000,
        "open": 0.00001230,
        "high": 0.00001250,
        "low": 0.00001220,
        "close": 0.00001245,
        "volume": 125000
      }
    ],
    "interval": "1h",
    "count": 100
  }
}
```

---

#### GET /api/search

Search tokens by name, symbol, or address.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (min 2 chars) |

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "address": "0x...",
        "chainId": "ethereum",
        "symbol": "PEPE",
        "name": "Pepe",
        "logoUrl": "https://..."
      }
    ],
    "count": 5
  }
}
```

---

#### GET /api/stream

Server-Sent Events stream of trending token prices.

**Response (SSE Stream):**
```
event: prices
data: {"ethereum-0x...": {"price": 0.00001234, "change24h": 5.2}, ...}

event: prices
data: {"ethereum-0x...": {"price": 0.00001238, "change24h": 5.5}, ...}
```

Updates every 5 seconds. Connection auto-closes after 5 minutes (reconnect to continue).

---

#### GET /api/health

System health check.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "goplus": { "status": "up", "latency": 234 },
      "dexscreener": { "status": "up", "latency": 156 },
      "geckoterminal": { "status": "up", "latency": 198 },
      "database": { "status": "up", "latency": 12 }
    },
    "cache": {
      "tokens": 1523,
      "riskScores": 892
    },
    "uptime": 864000
  }
}
```

---

#### API Key Management Endpoints

**GET /api/keys** — List your API keys (masked)
**POST /api/keys** — Create new API key
**DELETE /api/keys?id={keyId}** — Revoke an API key

**GET /api/subscription** — Get subscription info
**GET /api/usage** — Get API usage analytics
**GET /api/billing** — Get billing summary with overages

---

## Webhooks

Receive real-time notifications when events occur.

### Webhook Events

| Event | Description |
|-------|-------------|
| `risk.high` | Token risk score changed to HIGH |
| `risk.critical` | Token risk score changed to CRITICAL |
| `risk.honeypot` | Honeypot detected on token |
| `whale.buy` | Large buy transaction detected |
| `whale.sell` | Large sell transaction detected |
| `price.increase` | Price increased by threshold |
| `price.decrease` | Price decreased by threshold |

### Creating Webhooks

```bash
curl -X POST https://api.nullcheck.io/api/webhooks \
  -H "X-API-Key: nk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "webhookUrl": "https://your-server.com/webhook",
    "events": ["risk.critical", "whale.buy", "whale.sell"],
    "filters": {
      "chainId": "ethereum",
      "minValueUsd": 50000
    }
  }'
```

### Webhook Payload

```json
{
  "id": "evt_abc123",
  "event": "whale.buy",
  "timestamp": "2024-01-15T12:00:00Z",
  "apiVersion": "2024-01",
  "data": {
    "tokenAddress": "0x...",
    "chainId": "ethereum",
    "walletAddress": "0x...",
    "amount": 5000000,
    "valueUsd": 125000
  }
}
```

### Webhook Security

All webhooks are signed with HMAC-SHA256. Verify the signature:

```typescript
const signature = request.headers['x-nullcheck-signature'];
const timestamp = request.headers['x-nullcheck-timestamp'];
const payload = JSON.stringify(request.body);

const expectedSignature = crypto
  .createHmac('sha256', webhookSecret)
  .update(`${timestamp}.${payload}`)
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid signature');
}
```

### Webhook Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhooks` | GET | List webhook subscriptions |
| `/api/webhooks` | POST | Create webhook subscription |
| `/api/webhooks?id={id}` | PATCH | Update webhook subscription |
| `/api/webhooks?id={id}` | DELETE | Delete webhook subscription |
| `/api/webhooks/test` | POST | Send test webhook |

**Limits:** Maximum 10 webhooks per API key.

---

## Authentication & Security

### Session Authentication (UI)

Browser-based users authenticate via magic link email:

1. User enters email address
2. Supabase sends magic link
3. User clicks link, redirected to `/auth/callback`
4. Session cookie set automatically
5. User is authenticated

### API Key Authentication (Agents)

Programmatic access uses API keys:

1. PRO user creates API key at `/keys`
2. Key is shown once (user must save it)
3. Subsequent requests include key in header or query param
4. Key is hashed and verified against database

### CSRF Protection

State-changing requests from browsers require CSRF tokens:

1. Client fetches token from `GET /api/csrf`
2. Token set as httpOnly cookie automatically
3. Client includes token in `X-CSRF-Token` header
4. Server validates cookie matches header (double-submit pattern)

**Exempt from CSRF:**
- Safe methods (GET, HEAD, OPTIONS)
- API key authenticated requests

### Security Features

| Feature | Implementation |
|---------|----------------|
| API Key Storage | SHA-256 hashed (never plain text) |
| CSRF Tokens | Cryptographically random, 32 bytes |
| Token Comparison | Constant-time to prevent timing attacks |
| Session Cookies | httpOnly, Secure, SameSite=Strict |
| Input Validation | Address format per chain, bounds checking |
| Rate Limiting | Per-key daily limits with overage tracking |
| Query Timeouts | 5 second maximum on all database queries |

### Admin Endpoints

Protected by `ADMIN_SECRET` environment variable:

```bash
curl -H "Authorization: Bearer $ADMIN_SECRET" \
  https://api.nullcheck.io/api/admin/metrics
```

| Endpoint | Description |
|----------|-------------|
| `/api/admin/health` | Detailed system health |
| `/api/admin/metrics` | Usage metrics and statistics |
| `/api/admin/jobs` | Background job status |

### Cron Endpoints

Protected by `CRON_SECRET` or Vercel Cron header:

| Endpoint | Description |
|----------|-------------|
| `/api/cron/cleanup` | Clean stale data |
| `/api/cron/refresh` | Refresh cached data |
| `/api/cron/billing` | Process billing cycles |

---

## Technical Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Edge Runtime) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS v4 |
| State Management | Zustand |
| Data Fetching | React Query (TanStack Query) |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth |
| Payments | Stripe |
| Charts | Lightweight Charts (TradingView) |
| Font | SF Mono (local) |

### Caching Strategy

| Data Type | TTL | Location |
|-----------|-----|----------|
| Token Metrics | 30 seconds | In-memory + DB |
| Risk Scores | 1 hour | Database |
| Trending Tokens | 5 minutes | Materialized view |
| API Responses | Per-request ETags | Client-side |
| Batch Results | 1 minute | In-memory |

### Rate Limiting (External APIs)

| Service | Limit |
|---------|-------|
| GoPlus Security | 60 requests/minute |
| DexScreener | 300 requests/minute |
| GeckoTerminal | 30 requests/minute |

### Concurrency Control

- Batch risk analysis: 5 concurrent requests
- In-flight request deduplication (prevents cache stampede)
- Database query timeouts (5 seconds)

---

## Database Schema

### Tables

#### `tokens`
```sql
CREATE TABLE tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  logo_url TEXT,
  total_supply TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(address, chain_id)
);
```

#### `token_metrics`
```sql
CREATE TABLE token_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES tokens(id),
  price DECIMAL,
  price_change_1h DECIMAL,
  price_change_24h DECIMAL,
  price_change_7d DECIMAL,
  volume_24h DECIMAL,
  liquidity DECIMAL,
  market_cap DECIMAL,
  fdv DECIMAL,
  holders INTEGER,
  txns_24h_buys INTEGER,
  txns_24h_sells INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `risk_scores`
```sql
CREATE TABLE risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  total_score INTEGER NOT NULL,
  risk_level TEXT NOT NULL,
  liquidity_score INTEGER,
  liquidity_warnings JSONB,
  holder_score INTEGER,
  holder_warnings JSONB,
  contract_score INTEGER,
  contract_warnings JSONB,
  honeypot_score INTEGER,
  honeypot_warnings JSONB,
  warnings JSONB,
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(token_address, chain_id)
);
```

#### `user_subscriptions`
```sql
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  tier TEXT CHECK (tier IN ('free', 'pro')) DEFAULT 'free',
  status TEXT CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `api_keys`
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  hashed_key TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  tier TEXT CHECK (tier IN ('starter', 'builder', 'scale')) DEFAULT 'starter',
  daily_limit INTEGER NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ
);
```

#### `api_usage`
```sql
CREATE TABLE api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id),
  date DATE NOT NULL,
  request_count INTEGER DEFAULT 0,
  UNIQUE(api_key_id, date)
);
```

#### `watchlist_tokens`
```sql
CREATE TABLE watchlist_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  chain_id TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, chain_id, address)
);
```

#### `webhook_subscriptions`
```sql
CREATE TABLE webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id),
  webhook_url TEXT NOT NULL,
  events JSONB NOT NULL,
  filters JSONB,
  secret TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  failure_count INTEGER DEFAULT 0,
  last_triggered TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Materialized Views

#### `trending_tokens_mv`
Pre-computed trending tokens with risk scores for fast homepage loading:

```sql
CREATE MATERIALIZED VIEW trending_tokens_mv AS
SELECT
  t.*,
  tm.*,
  rs.total_score,
  rs.risk_level,
  rs.warnings
FROM tokens t
JOIN token_metrics tm ON t.id = tm.token_id
LEFT JOIN risk_scores rs ON t.address = rs.token_address AND t.chain_id = rs.chain_id
WHERE tm.volume_24h > 10000
ORDER BY tm.volume_24h DESC
LIMIT 200;
```

Refreshed every 5 minutes via cron job.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Stripe account (for subscriptions)
- API keys for external services

### Installation

```bash
# Clone the repository
git clone https://github.com/peterkellstrand/nullcheck.git
cd nullcheck

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Run database migrations
# (Execute SQL files in /supabase/migrations in order)

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
# Build
npm run build

# Start production server
npm start
```

---

## Environment Variables

```env
# ===================
# Supabase (Required)
# ===================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ===================
# External APIs (Required)
# ===================
GOPLUS_API_KEY=your_goplus_api_key
HELIUS_API_KEY=your_helius_api_key

# ===================
# External APIs (Optional)
# ===================
ALCHEMY_API_KEY=your_alchemy_api_key
TOKENSNIFFER_API_KEY=your_tokensniffer_api_key

# ===================
# Stripe (Required for subscriptions)
# ===================
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...

# ===================
# Application
# ===================
NEXT_PUBLIC_APP_URL=https://nullcheck.io

# ===================
# Security (Required for admin/cron)
# ===================
ADMIN_SECRET=your_admin_secret_key
CRON_SECRET=your_cron_secret_key

# ===================
# Optional Configuration
# ===================
RATE_LIMIT_REQUESTS_PER_MINUTE=60
```

---

## Project Structure

```
nullcheck/
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── api/
│   │   │   ├── admin/                    # Admin endpoints
│   │   │   │   ├── health/route.ts
│   │   │   │   ├── jobs/route.ts
│   │   │   │   └── metrics/route.ts
│   │   │   ├── billing/route.ts          # Billing summary
│   │   │   ├── cron/[job]/route.ts       # Background jobs
│   │   │   ├── csrf/route.ts             # CSRF token
│   │   │   ├── health/route.ts           # Public health check
│   │   │   ├── keys/route.ts             # API key management
│   │   │   ├── metrics/route.ts          # Public metrics
│   │   │   ├── ohlcv/[chain]/[address]/route.ts
│   │   │   ├── openapi/route.ts          # OpenAPI spec
│   │   │   ├── risk/
│   │   │   │   ├── [chain]/[address]/route.ts
│   │   │   │   ├── batch/route.ts
│   │   │   │   └── batch-stream/route.ts
│   │   │   ├── search/route.ts
│   │   │   ├── stream/route.ts           # SSE price stream
│   │   │   ├── stripe/
│   │   │   │   ├── checkout/route.ts
│   │   │   │   ├── portal/route.ts
│   │   │   │   └── webhook/route.ts
│   │   │   ├── subscription/route.ts
│   │   │   ├── token/[chain]/[address]/route.ts
│   │   │   ├── tokens/route.ts
│   │   │   ├── usage/route.ts
│   │   │   ├── watchlist/
│   │   │   │   ├── route.ts
│   │   │   │   ├── [chain]/[address]/route.ts
│   │   │   │   └── tokens/route.ts
│   │   │   ├── webhooks/
│   │   │   │   ├── route.ts
│   │   │   │   └── test/route.ts
│   │   │   └── whale/
│   │   │       ├── activity/[chain]/[address]/route.ts
│   │   │       └── holders/[chain]/[address]/route.ts
│   │   ├── auth/callback/route.ts        # OAuth callback
│   │   ├── admin/page.tsx                # Admin dashboard
│   │   ├── charts/page.tsx               # Multi-chart grid
│   │   ├── docs/page.tsx                 # API documentation
│   │   ├── keys/page.tsx                 # API key management
│   │   ├── pricing/page.tsx              # Subscription pricing
│   │   ├── token/[chain]/[address]/page.tsx
│   │   ├── watchlist/page.tsx
│   │   ├── layout.tsx                    # Root layout
│   │   └── page.tsx                      # Homepage
│   │
│   ├── components/
│   │   ├── auth/
│   │   │   ├── AuthButton.tsx
│   │   │   └── AuthModal.tsx
│   │   ├── charts/
│   │   │   ├── ChartGrid.tsx
│   │   │   ├── ChartGridItem.tsx
│   │   │   ├── ChartTokenSelector.tsx
│   │   │   └── PriceChart.tsx
│   │   ├── layout/
│   │   │   ├── Footer.tsx
│   │   │   └── Header.tsx
│   │   ├── risk/
│   │   │   ├── RiskBadge.tsx
│   │   │   └── RiskPanel.tsx
│   │   ├── subscription/
│   │   │   ├── SubscriptionProvider.tsx
│   │   │   └── UpgradePrompt.tsx
│   │   ├── tokens/
│   │   │   ├── TokenFilters.tsx
│   │   │   ├── TokenRow.tsx
│   │   │   ├── TokenSearch.tsx
│   │   │   └── TokenTable.tsx
│   │   ├── ui/
│   │   │   ├── Badge.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── Tooltip.tsx
│   │   ├── watchlist/
│   │   │   └── StarButton.tsx
│   │   ├── whale/
│   │   │   ├── TopHoldersPanel.tsx
│   │   │   ├── WhaleActivityBadge.tsx
│   │   │   ├── WhaleActivityFeed.tsx
│   │   │   └── index.ts
│   │   ├── Providers.tsx
│   │   └── ThemeProvider.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── usePriceStream.ts
│   │   ├── useSubscription.ts
│   │   ├── useWatchlist.ts
│   │   └── index.ts
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── alchemy.ts                # EVM RPC
│   │   │   ├── cache.ts                  # In-memory cache
│   │   │   ├── dexscreener.ts            # DEX data
│   │   │   ├── errors.ts                 # Error handling
│   │   │   ├── geckoterminal.ts          # DEX data
│   │   │   ├── goplus.ts                 # Security analysis
│   │   │   ├── helius.ts                 # Solana RPC
│   │   │   ├── rate-limiter.ts           # Rate limiting
│   │   │   ├── utils.ts                  # API utilities
│   │   │   └── whale.ts                  # Whale data
│   │   ├── auth/
│   │   │   ├── csrf.ts                   # CSRF protection
│   │   │   ├── verify-api-access.ts      # API key verification
│   │   │   └── index.ts
│   │   ├── billing/
│   │   │   └── metering.ts               # Usage metering
│   │   ├── db/
│   │   │   ├── api-metrics.ts
│   │   │   ├── supabase.ts               # Main DB client
│   │   │   ├── supabase-browser.ts
│   │   │   ├── supabase-server.ts
│   │   │   ├── subscription.ts
│   │   │   ├── watchlist.ts
│   │   │   └── index.ts
│   │   ├── jobs/
│   │   │   ├── billing.ts
│   │   │   ├── cleanup.ts
│   │   │   ├── refresh.ts
│   │   │   └── index.ts
│   │   ├── openapi/
│   │   │   └── index.ts                  # OpenAPI spec
│   │   ├── risk/
│   │   │   ├── analyzer.ts               # Risk orchestrator
│   │   │   ├── contract.ts
│   │   │   ├── holders.ts
│   │   │   ├── honeypot.ts
│   │   │   └── index.ts
│   │   ├── stripe/
│   │   │   ├── client.ts
│   │   │   ├── config.ts
│   │   │   └── index.ts
│   │   ├── trending/
│   │   │   └── index.ts                  # Trending score calc
│   │   ├── webhooks/
│   │   │   ├── service.ts                # Webhook delivery
│   │   │   ├── triggers.ts
│   │   │   └── index.ts
│   │   └── utils/
│   │       ├── format.ts                 # Formatting utilities
│   │       └── index.ts
│   │
│   ├── stores/
│   │   ├── chartGrid.ts
│   │   ├── theme.ts
│   │   ├── tokens.ts
│   │   ├── watchlist.ts
│   │   └── index.ts
│   │
│   ├── types/
│   │   ├── chain.ts                      # Chain definitions
│   │   ├── external.ts                   # External API types
│   │   ├── risk.ts                       # Risk types
│   │   ├── subscription.ts               # Subscription types
│   │   ├── token.ts                      # Token types
│   │   ├── webhook.ts                    # Webhook types
│   │   ├── whale.ts                      # Whale types
│   │   └── index.ts
│   │
│   └── middleware.ts                     # Next.js middleware
│
├── supabase/
│   └── migrations/                       # SQL migration files
│
├── public/                               # Static assets
├── .env.example                          # Environment template
├── next.config.ts                        # Next.js config
├── tailwind.config.ts                    # Tailwind config
├── tsconfig.json                         # TypeScript config
└── package.json
```

---

## External APIs

### GoPlus Security

**Purpose:** Token security analysis, honeypot detection, contract scanning

**Endpoints Used:**
- `GET /api/v1/token_security/{chain_id}?contract_addresses={address}`

**Rate Limit:** 60 requests/minute

**Documentation:** https://docs.gopluslabs.io/

---

### DexScreener

**Purpose:** Token prices, DEX pairs, trading volume

**Endpoints Used:**
- `GET /dex/tokens/{address}` — Token info with pairs
- `GET /dex/pairs/{chain}/{pairAddress}` — Pair details

**Rate Limit:** 300 requests/minute

**Documentation:** https://docs.dexscreener.com/

---

### GeckoTerminal

**Purpose:** Trending tokens, OHLCV data, backup price data

**Endpoints Used:**
- `GET /api/v2/networks/{network}/trending_pools` — Trending pools
- `GET /api/v2/networks/{network}/pools/{pool_address}/ohlcv/{timeframe}`

**Rate Limit:** 30 requests/minute

**Documentation:** https://www.geckoterminal.com/dex-api

---

### Helius

**Purpose:** Solana RPC, token holders, transaction data

**Endpoints Used:**
- `POST /` — Solana RPC methods
- `getAsset`, `getTokenAccounts`, `getSignaturesForAsset`

**Documentation:** https://docs.helius.xyz/

---

### Alchemy

**Purpose:** EVM RPC, token metadata, transaction data

**Endpoints Used:**
- Standard Ethereum JSON-RPC
- `alchemy_getTokenMetadata`

**Documentation:** https://docs.alchemy.com/

---

## Contributing

Contributions are welcome. Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes with clear messages
4. Push to the branch
5. Open a Pull Request

### Code Standards

- TypeScript strict mode (no `any`)
- Functional components with hooks
- Tailwind for styling (no inline styles)
- Descriptive variable names
- Error handling on all async operations
- Input validation on all API endpoints

### Commit Messages

Follow conventional commits:
```
feat: add whale activity endpoint
fix: correct rate limit calculation
docs: update API reference
refactor: simplify risk scoring logic
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Links

- **Website:** [nullcheck.io](https://nullcheck.io)
- **API Docs:** [nullcheck.io/docs](https://nullcheck.io/docs)
- **GitHub:** [github.com/peterkellstrand/nullcheck](https://github.com/peterkellstrand/nullcheck)

---

<p align="center">
  <strong>null//check</strong><br>
  <em>Know if you can sell before you buy.</em>
</p>
