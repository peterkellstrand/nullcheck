# null//check

**Risk-first DEX screener. Agent-first API platform.**

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

---

## Overview

nullcheck analyzes token risk before you trade. We detect honeypots, rug pulls, and scams across Ethereum, Base, and Solana.

**Free for humans. Premium for agents.**

- Traders use the web interface for free
- Bots and AI agents pay for API access

---

## Table of Contents

- [Supported Chains](#supported-chains)
- [Features](#features)
- [Risk Analysis](#risk-analysis)
- [Whale Tracking](#whale-tracking)
- [Pricing](#pricing)
- [API Reference](#api-reference)
- [Webhooks](#webhooks)
- [Authentication](#authentication)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Tech Stack](#tech-stack)
- [External APIs](#external-apis)
- [Contributing](#contributing)
- [License](#license)

---

## Supported Chains

| Chain | ID | Explorer |
|-------|-----|----------|
| Ethereum | `ethereum` | etherscan.io |
| Base | `base` | basescan.org |
| Solana | `solana` | solscan.io |

---

## Features

### Token Table & Heatmap

Two view modes for trending tokens:

**Table View** - Sortable columns with:
- Price and 1h/24h/7d change
- Volume, liquidity, market cap
- Holder count and transaction activity
- Risk score badge
- Whale activity indicator

**Heatmap View** - Visual grid colored by:
- 24h price change (green/red)
- Volume (blue intensity)
- Risk score (green → red)

Filter by chain, sort by any column, search by name/symbol/address.

### Advanced Filters (PRO)

Filter tokens by:
- Risk score range (0-100)
- Top 10 holder concentration
- LP lock percentage

### Token Detail Pages

`/token/{chain}/{address}` shows:
- Interactive price chart with multiple timeframes
- **Heikin Ashi** chart type toggle (smooths price action)
- **Drawing tools** - Trend lines, horizontal lines, Fibonacci retracements
- **Chart comparison** - Overlay up to 5 tokens (% change)
- Full metrics breakdown
- Risk analysis panel with warnings
- **Risk score history** (PRO) - Track how risk changes over time
- Top holders list
- Whale transaction feed
- DEX pool information

### Price Alerts

Set alerts for price targets:
- Alert when price goes above or below target
- Email notifications when triggered
- Manage at `/alerts`

| Tier | Alert Limit |
|------|-------------|
| Free | 10 |
| PRO | Unlimited |

### Multi-Chart Grid

View up to 16 charts simultaneously at `/charts`.

| Tier | Chart Slots |
|------|-------------|
| Free | 9 |
| PRO | 16 |

### Data Export (PRO)

Export your data as CSV or JSON:
- Watchlist tokens with metrics
- Trending tokens snapshot

### Watchlist

Save tokens at `/watchlist`. Synced across devices.

### Dark/Light Theme

Toggle in footer. Persists to localStorage.

---

## Risk Analysis

Every token gets a risk score from 0-100.

### Risk Levels

| Level | Score | Color | Meaning |
|-------|-------|-------|---------|
| LOW | 0-14 | Green | Generally safe |
| MEDIUM | 15-29 | Yellow | Some concerns |
| HIGH | 30-49 | Orange | Significant red flags |
| CRITICAL | 50-100 | Red | Likely scam |

### Risk Categories

**Honeypot Detection**
- Can you actually sell?
- Hidden transfer fees
- Anti-whale mechanisms
- Time-locked selling

**Contract Analysis**
- Proxy contracts (upgradeable)
- Mint functions
- Blacklist capabilities
- Pause functions
- Hidden owner

**Holder Concentration**
- Top 10 holder percentage
- Creator wallet holdings
- Team wallet identification

**Liquidity Risk**
- Total liquidity depth
- Liquidity-to-mcap ratio
- Pool age

**LP Security**
- LP tokens burned
- LP tokens locked
- Lock duration

### Score Calculation

```
totalScore = (
  honeypot * 0.35 +
  contract * 0.25 +
  holders * 0.20 +
  liquidity * 0.15 +
  lpSecurity * 0.05
)
```

### Risk Score History (PRO)

Track how a token's risk score changes over time:
- Detect rug pull setups (risk starts low, spikes later)
- Monitor improvements (LP locked, ownership renounced)
- 7 / 30 / 90 day history

---

## Whale Tracking

### Top Holders

Displays largest token holders:
- Address (truncated)
- Balance and percentage
- Contract/locked indicators
- Tags: DEX, Burn, Team, etc.

### Whale Activity

Recent large transactions:
- Buy/sell indicator
- Amount and USD value
- Wallet address
- Time ago

### Thresholds

```typescript
WHALE_THRESHOLDS = {
  minValueUsd: 10000,      // $10k minimum
  minSupplyPercent: 1,     // or 1% of supply
}
```

---

## Pricing

### For Humans (Web Interface)

| | Free | PRO |
|--|------|-----|
| **Price** | $0 | $10/month or $96/year |
| Risk Analysis | Full | Full |
| Watchlist | Unlimited | Unlimited |
| Chart Slots | 9 | 16 |
| Price Alerts | 10 | Unlimited |
| Manual Checks/Day | 50 | 200 |
| Data Export | No | CSV & JSON |
| Risk History | No | 90 days |
| Advanced Filters | No | Yes |
| Priority Support | No | Yes |
| API Access | No | No |

### For Agents & Bots (API Access)

| | Developer | Professional | Business | Enterprise |
|--|-----------|--------------|----------|------------|
| **Price** | $49/month | $199/month | $499/month | Custom |
| API Calls/Month | 10,000 | 100,000 | 500,000 | 1M+ |
| Batch Size | 10 tokens | 50 tokens | 100 tokens | 100 tokens |
| Webhooks | 5 | Unlimited | Unlimited | Unlimited |
| Uptime SLA | 99% | 99.5% | 99.9% | 99.95% |
| Overage Rate | $0.015/100 | $0.012/100 | $0.010/100 | Custom |
| Dedicated Support | No | No | Yes | Yes |
| Custom Integrations | No | No | Yes | Yes |

**API Key Delivery:**
- Generated automatically on subscription
- Emailed immediately (save it - shown only once)
- Manage at `/keys`

---

## API Reference

### Base URL

```
https://api.nullcheck.io
```

### Authentication

```bash
curl -H "X-API-Key: nk_your_key_here" https://api.nullcheck.io/api/tokens
```

### Rate Limits

Tracked per API key per month. Headers included in responses:

```
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9542
X-RateLimit-Reset: 1705363200
```

### Response Format

```json
{
  "success": true,
  "data": { ... }
}
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid token address"
  }
}
```

### Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid parameters |
| 401 | `UNAUTHORIZED` | Missing API key |
| 401 | `INVALID_KEY` | Revoked or invalid key |
| 404 | `NOT_FOUND` | Resource not found |
| 429 | `RATE_LIMITED` | Limit exceeded |
| 500 | `INTERNAL_ERROR` | Server error |

---

### Endpoints

#### GET /api/tokens

Trending tokens with metrics.

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| chain | string | all | Filter by chain |
| limit | number | 50 | Max tokens (1-100) |

**Response:**
```json
{
  "success": true,
  "data": {
    "tokens": [{
      "address": "0x...",
      "chainId": "ethereum",
      "symbol": "PEPE",
      "name": "Pepe",
      "metrics": {
        "price": 0.00001234,
        "priceChange24h": -5.2,
        "volume24h": 5000000,
        "liquidity": 2500000,
        "marketCap": 50000000
      },
      "risk": {
        "totalScore": 23,
        "level": "medium"
      }
    }]
  }
}
```

---

#### GET /api/token/{chain}/{address}

Token details.

**Path:**
| Param | Description |
|-------|-------------|
| chain | ethereum, base, or solana |
| address | Token contract address |

---

#### GET /api/risk/{chain}/{address}

Risk analysis for a token.

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| refresh | boolean | false | Force fresh analysis |

**Response:**
```json
{
  "success": true,
  "data": {
    "totalScore": 23,
    "level": "medium",
    "honeypot": { "score": 0, "warnings": [] },
    "contract": { "score": 10, "warnings": [] },
    "holders": { "score": 35, "warnings": ["Top 10 hold 65%"] },
    "liquidity": { "score": 15, "warnings": [] },
    "analyzedAt": "2024-01-15T12:00:00Z"
  }
}
```

---

#### GET /api/risk/history/{chain}/{address} (PRO)

Historical risk scores for a token.

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| days | number | 30 | History period (max 90) |

**Response:**
```json
{
  "success": true,
  "data": {
    "chainId": "ethereum",
    "address": "0x...",
    "days": 30,
    "history": [{
      "totalScore": 23,
      "riskLevel": "medium",
      "honeypotScore": 0,
      "contractScore": 10,
      "holdersScore": 35,
      "liquidityScore": 15,
      "recordedAt": "2024-01-15T12:00:00Z"
    }]
  }
}
```

---

#### POST /api/risk/batch

Analyze multiple tokens.

**Request:**
```json
{
  "tokens": [
    { "address": "0x...", "chainId": "ethereum" },
    { "address": "0x...", "chainId": "base" }
  ]
}
```

**Batch Limits:**
| Tier | Max Tokens |
|------|------------|
| Developer | 10 |
| Professional | 50 |
| Business | 100 |

---

#### GET /api/whale/holders/{chain}/{address}

Top token holders.

**Response:**
```json
{
  "success": true,
  "data": {
    "holders": [{
      "address": "0x1234...5678",
      "balance": "1000000000000000000000",
      "percent": 15.5,
      "isContract": true,
      "tag": "DEX"
    }],
    "totalHolders": 15000
  }
}
```

---

#### GET /api/whale/activity/{chain}/{address}

Whale transaction activity.

**Response:**
```json
{
  "success": true,
  "data": {
    "count24h": 45,
    "buyCount24h": 28,
    "sellCount24h": 17,
    "netFlow24h": 11,
    "recentTransactions": [{
      "txHash": "0x...",
      "type": "buy",
      "amount": 1000000,
      "valueUsd": 25000,
      "timestamp": 1705319000
    }]
  }
}
```

---

#### GET /api/ohlcv/{chain}/{address}

OHLCV candlestick data.

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| interval | string | 1h | 1m, 5m, 15m, 1h, 4h, 1d |
| limit | number | 100 | Max candles (1-500) |

---

#### GET /api/alerts

List user's price alerts.

---

#### POST /api/alerts

Create a price alert.

**Request:**
```json
{
  "chainId": "ethereum",
  "tokenAddress": "0x...",
  "tokenSymbol": "PEPE",
  "alertType": "price_above",
  "targetPrice": 0.00002
}
```

---

#### DELETE /api/alerts/{id}

Delete a price alert.

---

#### GET /api/export

Export data (PRO only).

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| type | string | `watchlist` or `tokens` |
| format | string | `csv` or `json` |

---

#### GET /api/search

Search tokens.

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| q | string | Yes | Query (min 2 chars) |

---

#### GET /api/stream

SSE stream of price updates. Updates every 5 seconds.

---

#### GET /api/health

System health check.

---

## Webhooks

Receive notifications when events occur.

### Events

| Event | Description |
|-------|-------------|
| `risk.high` | Risk changed to HIGH |
| `risk.critical` | Risk changed to CRITICAL |
| `risk.honeypot` | Honeypot detected |
| `whale.buy` | Large buy detected |
| `whale.sell` | Large sell detected |

### Create Webhook

```bash
curl -X POST https://api.nullcheck.io/api/webhooks \
  -H "X-API-Key: nk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "webhookUrl": "https://your-server.com/webhook",
    "events": ["risk.critical", "whale.buy"]
  }'
```

### Payload

```json
{
  "id": "evt_abc123",
  "event": "whale.buy",
  "timestamp": "2024-01-15T12:00:00Z",
  "data": {
    "tokenAddress": "0x...",
    "chainId": "ethereum",
    "valueUsd": 125000
  }
}
```

### Security

Webhooks are signed with HMAC-SHA256. Verify the `x-nullcheck-signature` header.

**Limits:** 5 webhooks (Developer), Unlimited (Professional+)

---

## Authentication

### Web Users

Magic link email via Supabase Auth.

### API Users

API key in header:
```
X-API-Key: nk_[32 characters]
```

Keys are SHA-256 hashed before storage. Full key shown only once at creation.

### CSRF Protection

Browser requests require CSRF token from `GET /api/csrf`.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account
- Stripe account

### Installation

```bash
git clone https://github.com/peterkellstrand/nullcheck.git
cd nullcheck
npm install
cp .env.example .env.local
# Edit .env.local with your keys
npm run dev
```

Visit http://localhost:3000

### Build

```bash
npm run build
npm start
```

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# External APIs
GOPLUS_API_KEY=your_key
HELIUS_API_KEY=your_key
ALCHEMY_API_KEY=your_key

# Stripe - Human tiers
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...

# Stripe - Agent tiers
STRIPE_PRICE_DEVELOPER=price_...
STRIPE_PRICE_PROFESSIONAL=price_...
STRIPE_PRICE_BUSINESS=price_...
STRIPE_PRICE_PROFESSIONAL_OVERAGE=price_...
STRIPE_PRICE_BUSINESS_OVERAGE=price_...

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=nullcheck <noreply@nullcheck.io>

# App
NEXT_PUBLIC_APP_URL=https://nullcheck.io
ADMIN_SECRET=your_secret
CRON_SECRET=your_secret
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Data Fetching | TanStack Query |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Payments | Stripe |
| Email | Resend |
| Charts | Lightweight Charts |

---

## External APIs

| Service | Purpose | Rate Limit |
|---------|---------|------------|
| GoPlus | Security analysis | 60/min |
| DexScreener | Token prices, pairs | 300/min |
| GeckoTerminal | Trending, OHLCV | 30/min |
| Helius | Solana RPC | varies |
| Alchemy | EVM RPC | varies |
| Resend | Email delivery | 100/day (free) |

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit with clear messages
4. Open a Pull Request

### Standards

- TypeScript strict mode
- Functional components
- Tailwind for styling
- Error handling on async operations
- Input validation on API endpoints

---

## License

MIT License. See [LICENSE](LICENSE).

---

<p align="center">
  <strong>null//check</strong><br>
  <em>Know if you can sell before you buy.</em>
</p>
