# null//check

**The risk-first DEX screener that puts your safety before profits.**

Zero promoted tokens. Zero paid placements. Zero bullshit.

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

---

## Mission Statement

The cryptocurrency space is plagued by scams. Every day, traders lose money to honeypots, rug pulls, and malicious contracts. Existing DEX screeners have become part of the problem—accepting payment from token projects to "trend" their coins, burying risk information in submenus, and prioritizing engagement over user safety.

**null//check exists to fix this.**

We believe that:

- **Risk should be visible, not hidden.** Honeypot detection and rug-pull indicators belong front and center, not buried three clicks deep.
- **Trending should be organic.** What you see should reflect actual market activity, not who paid the most for visibility.
- **Tools should serve users, not advertisers.** Our revenue comes from subscriptions, keeping our incentives aligned with yours.
- **Data should be accessible.** AI agents and trading bots deserve the same quality data as human traders.

null//check is built for the paranoid trader—the one who checks the contract before aping, who wants to know holder concentration before buying, who understands that in crypto, the house always wins unless you do your homework.

---

## Why null//check?

### The Problem

| What Other Screeners Do | What null//check Does |
|------------------------|----------------------|
| Accept payment for "trending" placement | Show only organic activity |
| Hide risk scores in submenus | Display risk badges prominently |
| Optimize for engagement metrics | Optimize for trader safety |
| Charge projects for visibility | Charge users for features |
| Show you what they're paid to show | Show you what's actually happening |

### The Difference

When you open null//check, the first thing you see is the **risk score**. Not the price. Not the volume. The risk score. Because knowing whether you can actually sell your tokens matters more than knowing the current price.

We analyze every token across five risk vectors:

1. **Honeypot Detection** — Can you actually sell? We simulate transactions to find out.
2. **Contract Analysis** — Proxy contracts, mint functions, blacklist capabilities, pause functions.
3. **Holder Concentration** — Who owns how much? Is the creator still holding?
4. **Liquidity Risk** — Pool depth, LP lock status, time since deployment.
5. **LP Security** — Burned vs. locked liquidity, pool composition.

---

## Features

### Real-Time Risk Analysis

Every token displayed on null//check has been analyzed for potential risks. Our scoring system provides clear, actionable intelligence:

| Risk Level | Score | What It Means |
|------------|-------|---------------|
| `LOW` | 0-14 | Standard caution applies. Generally safe. |
| `MEDIUM` | 15-29 | Some concerns identified. Investigate further. |
| `HIGH` | 30-49 | Significant red flags. High probability of loss. |
| `CRITICAL` | 50+ | Likely scam or honeypot. Avoid entirely. |

Risk badges are color-coded and visible at a glance—no clicking required.

### Live Price Streaming

Prices update in real-time via Server-Sent Events (SSE). No refresh needed. Watch the market move as it happens.

- Sub-second price updates
- Flash indicators for significant moves
- Connection status always visible

### Multi-Chain Support

Trade across the chains that matter:

- **Ethereum** — The original DeFi ecosystem
- **Base** — Coinbase's L2 with growing activity
- **Solana** — High-speed, low-cost transactions
- **Arbitrum** — Ethereum scaling with deep liquidity
- **Polygon** — Accessible DeFi for everyone

All chains in a unified interface. Filter by chain or view everything together.

### Whale Tracking

Know what the big players are doing:

- **Top Holders Panel** — See the largest wallets, their percentage ownership, and whether they're contracts or EOAs
- **Whale Activity Feed** — Track large buys and sells in real-time
- **Sentiment Indicators** — Quick read on whether whales are accumulating or distributing
- **Wallet Tags** — Identify DEX routers, burn addresses, team wallets, and locked tokens

| Feature | Free | PRO |
|---------|------|-----|
| Top Holders Shown | 5 wallets | 20 wallets |
| Whale Feed | Last 5 transactions | Unlimited |

### Multi-Chart Grid

Serious traders watch multiple tokens simultaneously. null//check supports:

- **2x2 Grid** — Four charts, perfect for focused analysis
- **3x3 Grid** — Nine charts for broader market monitoring
- **Auto Layout** — Responsive grid that adapts to your screen

Each chart includes:
- OHLCV candlesticks
- Volume histogram
- Moving averages (7 and 25 period)
- Multiple timeframes (5m, 15m, 1h, 4h, 1d, 1w)

### Watchlist

Track the tokens that matter to you:

- Star any token to add it to your watchlist
- Access your watchlist from any device
- Synced to your account automatically

### Terminal Aesthetic

null//check is designed for power users who value information density over visual fluff:

- **SF Mono typography** — Monospace font for aligned data columns
- **Dark/Light modes** — Easy on the eyes, day or night
- **Minimal chrome** — Every pixel serves a purpose
- **Keyboard-friendly** — Navigate efficiently

---

## PRO Subscription

Support the mission and unlock enhanced capabilities.

**$5/month** or **$39/year** (save 35%)

| Feature | Free | PRO |
|---------|------|-----|
| Watchlist Tokens | 10 | Unlimited |
| Chart Slots | 4 | 16 |
| Price Alerts | 3 | Unlimited |
| Top Holders Shown | 5 | 20 |
| Whale Feed Depth | 5 transactions | Unlimited |
| API Access | — | Included |

PRO subscriptions directly fund development and keep null//check free from advertising pressure.

---

## API for AI Agents & Bots

The future of trading is automated. null//check provides programmatic access to our data for AI agents, trading bots, and custom integrations.

### Why API Access Matters

- **AI Agents** need reliable data sources to make informed decisions
- **Trading Bots** require real-time risk assessment before executing trades
- **Research Tools** benefit from structured, queryable token data
- **Portfolio Managers** can automate risk monitoring across holdings

### Pricing Tiers

| Tier | API Calls/Day | Batch Size | Price |
|------|---------------|------------|-------|
| **Starter** | 10,000 | 10 tokens | Free with PRO |
| **Builder** | 100,000 | 50 tokens | $19/month |
| **Scale** | 1,000,000 | 100 tokens | $49/month |

### Authentication

```bash
# Header authentication (recommended)
curl -H "x-api-key: nk_your_key_here" https://nullcheck.io/api/tokens

# Query parameter authentication
curl "https://nullcheck.io/api/tokens?api_key=nk_your_key_here"
```

### Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tokens` | GET | List trending tokens with metrics and risk scores |
| `/api/token/{chain}/{address}` | GET | Detailed token information |
| `/api/risk/{chain}/{address}` | GET | Full risk analysis for a single token |
| `/api/risk/batch` | POST | Analyze multiple tokens in one request |
| `/api/whale/holders/{chain}/{address}` | GET | Top token holders |
| `/api/whale/activity/{chain}/{address}` | GET | Recent whale transactions |
| `/api/search?q={query}` | GET | Search tokens by name, symbol, or address |

### Response Format

All endpoints return JSON with consistent structure:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-15T12:00:00Z",
    "cached": false
  }
}
```

### Rate Limiting

- Requests are tracked per API key per day
- Limits reset at midnight UTC
- Usage dashboard available in the UI
- Overage requests return `429 Too Many Requests`

---

## Marketing Plan

### Phase 1: Foundation (Weeks 1-4)

**Objective:** Establish presence and credibility on X (Twitter)

#### Content Pillars

1. **Educational Content** (40%)
   - "How to spot a honeypot in 30 seconds"
   - "5 red flags in token contracts"
   - "What LP lock actually means"
   - Thread format for deep dives

2. **Real-Time Alerts** (30%)
   - High-risk tokens trending on other platforms
   - Whale movements on significant tokens
   - New token launches with risk analysis
   - "This token has a 94 risk score. Here's why."

3. **Product Updates** (20%)
   - Feature announcements
   - Behind-the-scenes development
   - User feedback implementation
   - Roadmap progress

4. **Community Engagement** (10%)
   - Reply to crypto discussions
   - Quote tweet popular takes with data
   - Answer questions about token safety

#### Posting Schedule

| Day | Content Type | Time (UTC) |
|-----|--------------|------------|
| Monday | Educational thread | 14:00 |
| Tuesday | Risk alert | 16:00 |
| Wednesday | Product update | 15:00 |
| Thursday | Educational thread | 14:00 |
| Friday | Weekly recap + risk alerts | 17:00 |
| Weekend | Community engagement | Flexible |

#### Voice & Tone

- **Direct** — No hedging, no "maybe this is a scam"
- **Data-driven** — Always back claims with numbers
- **Helpful** — Educate, don't condescend
- **Confident** — We know our product is better

#### Sample Posts

**Educational:**
```
🧵 How to spot a honeypot in 30 seconds:

1. Check if sell tax > buy tax (red flag)
2. Look for blacklist functions in contract
3. Verify LP is locked, not just "locked"
4. Check holder concentration—if top 10 hold >50%, be careful

Or just use null//check. We do this automatically.
```

**Risk Alert:**
```
⚠️ $TRENDING is currently #3 on [competitor]

Our analysis:
- Risk Score: 87 (CRITICAL)
- Sell tax: 99%
- Top holder: 45% of supply
- LP: Unlocked

This is a honeypot. You cannot sell.

Data: nullcheck.io/token/eth/0x...
```

**Product Update:**
```
New: Whale tracking is live 🐋

See exactly who's buying and selling:
- Top 20 holders (PRO)
- Real-time whale transactions
- Buy/sell sentiment indicators

Because knowing what smart money does matters.

nullcheck.io
```

### Phase 2: Growth (Weeks 5-12)

**Objective:** Build community and establish thought leadership

#### Tactics

1. **Influencer Outreach**
   - Identify 10-20 crypto safety advocates
   - Offer free PRO accounts for honest reviews
   - Collaborate on educational content
   - No paid promotions (stays authentic)

2. **Community Building**
   - Launch Discord server
   - Create Telegram announcement channel
   - Host weekly "Rug Report" spaces on X
   - Spotlight community members who catch scams

3. **SEO Content**
   - Blog posts on token safety
   - Guides for new traders
   - Comparison content (vs competitors)
   - Target "how to avoid crypto scams" keywords

4. **Partnerships**
   - Wallet providers (risk warnings)
   - Other non-competing tools
   - Educational platforms
   - Security researchers

### Phase 3: Scale (Weeks 13+)

**Objective:** Become the default risk-checking tool

#### Tactics

1. **API Adoption**
   - Reach out to bot developers
   - Create SDK/libraries for popular languages
   - Showcase integrations
   - Developer documentation and examples

2. **Media Coverage**
   - Press releases for major features
   - Contributed articles to crypto publications
   - Podcast appearances
   - Conference presentations

3. **Paid Acquisition** (if metrics support)
   - X promoted posts for educational content
   - Retargeting for site visitors
   - Conversion-focused landing pages

### Key Metrics

| Metric | Week 4 Target | Week 12 Target |
|--------|---------------|----------------|
| X Followers | 1,000 | 10,000 |
| Daily Active Users | 500 | 5,000 |
| PRO Subscribers | 50 | 500 |
| API Keys Created | 20 | 200 |
| Risk Checks/Day | 10,000 | 100,000 |

### Budget Allocation

| Category | % of Budget | Notes |
|----------|-------------|-------|
| Content Creation | 40% | Graphics, video, writing |
| Community Management | 25% | Engagement, moderation |
| Influencer Partnerships | 20% | Free accounts, collaborations |
| Paid Promotion | 10% | X ads (Phase 3 only) |
| Tools & Software | 5% | Scheduling, analytics |

---

## Technical Architecture

```
src/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── keys/                 # API key management
│   │   ├── ohlcv/                # Chart data (OHLCV)
│   │   ├── risk/                 # Risk analysis
│   │   ├── search/               # Token search
│   │   ├── stream/               # SSE price streaming
│   │   ├── stripe/               # Payment processing
│   │   ├── subscription/         # Subscription status
│   │   ├── token/                # Token details
│   │   ├── tokens/               # Token listing
│   │   ├── watchlist/            # Watchlist CRUD
│   │   └── whale/                # Whale tracking
│   ├── auth/callback/            # OAuth callback
│   ├── charts/                   # Multi-chart page
│   ├── keys/                     # API key management UI
│   ├── pricing/                  # Subscription page
│   ├── token/[chain]/[address]/  # Token detail page
│   ├── watchlist/                # Watchlist page
│   └── page.tsx                  # Homepage
├── components/
│   ├── auth/                     # Authentication UI
│   ├── charts/                   # Chart components
│   ├── risk/                     # Risk display components
│   ├── subscription/             # Subscription components
│   ├── tokens/                   # Token table components
│   ├── ui/                       # Base UI components
│   ├── watchlist/                # Watchlist components
│   └── whale/                    # Whale tracking components
├── hooks/                        # React hooks
├── lib/
│   ├── api/                      # External API clients
│   ├── auth/                     # Authentication helpers
│   ├── db/                       # Database clients
│   ├── risk/                     # Risk analysis engine
│   ├── stripe/                   # Payment integration
│   └── utils/                    # Utility functions
├── stores/                       # Zustand state stores
└── types/                        # TypeScript definitions
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| State Management | Zustand |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth |
| Payments | Stripe |
| Font | SF Mono (local) |

### External APIs

| Provider | Purpose |
|----------|---------|
| DexScreener | Token data, prices, pools |
| GeckoTerminal | Trending tokens, backup data |
| GoPlus Security | Risk analysis, honeypot detection |
| Helius | Solana RPC, token holders |
| Alchemy | EVM RPC |

### Database Schema

```sql
-- User watchlists
user_watchlists (
  user_id UUID REFERENCES auth.users,
  token_address TEXT,
  chain_id TEXT,
  created_at TIMESTAMPTZ
)

-- User subscriptions
user_subscriptions (
  user_id UUID REFERENCES auth.users,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  tier TEXT CHECK (tier IN ('free', 'pro')),
  status TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ
)

-- API keys for agents/bots
api_keys (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  api_key TEXT UNIQUE,
  name TEXT,
  tier TEXT CHECK (tier IN ('starter', 'builder', 'scale')),
  daily_limit INTEGER,
  created_at TIMESTAMPTZ,
  last_used TIMESTAMPTZ,
  is_revoked BOOLEAN
)

-- API usage tracking
api_usage (
  api_key_id UUID REFERENCES api_keys,
  date DATE,
  request_count INTEGER,
  UNIQUE(api_key_id, date)
)

-- Cached token data
tokens, token_metrics, risk_scores, pools
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Stripe account (for subscriptions)

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
npx supabase db push

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Environment Variables

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Risk Analysis
GOPLUS_API_KEY=your_goplus_key
HELIUS_API_KEY=your_helius_key

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Roadmap

### Completed

- [x] Real-time token table with risk scores
- [x] Multi-chain support (ETH, Base, Solana, Arbitrum, Polygon)
- [x] GoPlus risk integration
- [x] Search and filtering
- [x] Terminal UI with SF Mono
- [x] SSE price streaming
- [x] User authentication
- [x] Watchlist functionality
- [x] Multi-chart grid
- [x] Token detail pages
- [x] Dark/light theme
- [x] PRO subscription system
- [x] Whale tracking
- [x] API for AI agents (3-tier pricing)

### In Progress

- [ ] Price alerts (Telegram/Discord)
- [ ] Mobile-optimized views
- [ ] Advanced charting tools

### Planned

- [ ] Browser extension
- [ ] Shared watchlists
- [ ] Token notes/comments
- [ ] Risk score history
- [ ] Native mobile app
- [ ] Additional chains

---

## Contributing

Contributions are welcome. Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

### Code Standards

- TypeScript strict mode
- Functional components with hooks
- Tailwind for styling
- Descriptive names over comments
- Test critical paths

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Contact

- **Website:** [nullcheck.io](https://nullcheck.io)
- **X (Twitter):** [@nullcheck](https://x.com/nullcheck)
- **GitHub:** [github.com/peterkellstrand/nullcheck](https://github.com/peterkellstrand/nullcheck)

---

<p align="center">
  <strong>null//check</strong><br>
  <em>Because you should know if you can sell before you buy.</em>
</p>
