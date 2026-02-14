# null//check

A risk-first DEX screener with a cyberpunk terminal aesthetic. Zero promoted tokens. Organic trending. Honeypot detection first.

## Philosophy

The DEX screener landscape is cluttered with promoted tokens, paid placements, and interfaces that bury critical risk information. null//check takes a different approach:

- **Risk First** — Honeypot detection and rug-pull indicators are prominently displayed, not hidden in submenus
- **Zero Promoted Tokens** — What you see is organic. No paid placements, no "trending" manipulation
- **Dense Information** — Terminal-style UI optimized for power users who need data at a glance
- **User-Funded** — Revenue comes from PRO subscriptions, not token projects, keeping analysis unbiased

## Features

### Live Data & Streaming
- **Real-Time Price Updates** — Server-Sent Events (SSE) stream price changes live
- **Multi-Chain Support** — Ethereum, Base, and Solana tokens in a unified view
- **Live Token Data** — Prices, 1h/24h changes, volume, and liquidity via DexScreener API

### Risk Analysis
- **Real-Time Risk Scoring** — Integrated GoPlus security API for honeypot detection, contract analysis, and holder concentration
- **Batch Risk Analysis** — Analyze multiple tokens simultaneously
- **Risk Badges** — Color-coded indicators (LOW/MEDIUM/HIGH/CRITICAL) at a glance

### Charts
- **Multi-Chart Grid** — View up to 4 charts (Free) or 16 charts (PRO) simultaneously
- **Multiple Layouts** — 2x2, 3x3, or auto-responsive grid layouts
- **Timeframe Selection** — 1h, 4h, 1d, 1w chart intervals
- **OHLCV Data** — Full candlestick charts with volume

### Watchlist
- **Personal Watchlist** — Save tokens you're tracking
- **Quick Toggle** — Star/unstar tokens from any view
- **Persistent Storage** — Synced to your account via Supabase

### User Accounts
- **Magic Link Auth** — Passwordless email authentication
- **Session Persistence** — Stay logged in across sessions
- **Secure** — Powered by Supabase Auth with Row Level Security

### Whale Tracking
- **Top Holders Panel** — View largest token holders with percentage bars and wallet tags
- **Whale Activity Feed** — Track recent large transactions with buy/sell indicators
- **Whale Column** — See whale sentiment at a glance in the main token table
- **Multi-Chain Support** — Works across Ethereum, Base, and Solana
- **Data Sources** — Helius for Solana, GoPlus for EVM chains

### PRO Subscription
- **$5/month or $39/year** (save 35%)
- **Expanded Limits:**

| Feature | Free | PRO |
|---------|------|-----|
| Watchlist | 10 tokens | Unlimited |
| Charts | 4 slots | 16 slots |
| Alerts | 3 | Unlimited |
| Top Holders | 5 wallets | 20 wallets |
| Whale Feed | 5 transactions | Unlimited |

- **Stripe Integration** — Secure payment processing
- **Customer Portal** — Manage subscription anytime

### UI/UX
- **Terminal Aesthetic** — Monochrome design with SF Mono typography
- **Dark/Light Mode** — Toggle between themes
- **Sortable Data Grid** — Click any column header to sort
- **Chain Filtering** — Filter by blockchain
- **Token Search** — Find tokens by name, symbol, or address

## Risk Scoring System

Tokens are analyzed across multiple risk vectors:

| Category | Max Points | What It Checks |
|----------|------------|----------------|
| Honeypot Detection | 50 | Can you actually sell? Simulated buy/sell transactions |
| Contract Risks | 30 | Proxy contracts, mint functions, blacklist capabilities |
| Holder Concentration | 25 | Top holder %, creator holdings, distribution |
| Liquidity Risk | 25 | Pool depth, LP lock status, rug-pull potential |
| LP Security | 20 | Burned LP, locked liquidity, pool age |

**Risk Levels:**
- `LOW` (0-14): Generally safe, standard caution applies
- `MEDIUM` (15-29): Some concerns, investigate before aping
- `HIGH` (30-49): Significant red flags, high risk of loss
- `CRITICAL` (50+): Likely scam or honeypot, avoid

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **State**: Zustand + React Query
- **Database**: Supabase (PostgreSQL + Auth)
- **Payments**: Stripe
- **Font**: SF Mono (local)
- **APIs**:
  - DexScreener — Token data, pools, prices
  - GoPlus Security — Risk analysis, honeypot detection
  - GeckoTerminal — Backup data source
  - Helius — Solana RPC
  - Alchemy — EVM RPC

## Architecture

```
src/
├── app/                       # Next.js App Router
│   ├── api/
│   │   ├── ohlcv/            # OHLCV chart data
│   │   ├── risk/             # Risk analysis (single + batch)
│   │   ├── search/           # Token search
│   │   ├── stream/           # SSE price streaming
│   │   ├── stripe/           # Checkout, portal, webhook
│   │   ├── subscription/     # User subscription status
│   │   ├── token/            # Token details
│   │   ├── tokens/           # Token list
│   │   ├── watchlist/        # Watchlist CRUD
│   │   └── whale/            # Whale tracking (holders, activity)
│   ├── auth/callback/        # OAuth callback
│   ├── charts/               # Multi-chart page
│   ├── pricing/              # Subscription pricing
│   ├── token/[chain]/[addr]/ # Token detail page
│   ├── watchlist/            # Watchlist page
│   └── page.tsx              # Homepage
├── components/
│   ├── auth/                 # AuthButton, AuthModal
│   ├── charts/               # ChartGrid, PriceChart
│   ├── layout/               # Header, Footer
│   ├── risk/                 # RiskBadge, RiskPanel
│   ├── subscription/         # SubscriptionProvider, UpgradePrompt
│   ├── tokens/               # TokenTable, TokenRow, TokenSearch
│   ├── ui/                   # Button, Badge, Skeleton, etc.
│   ├── watchlist/            # StarButton
│   └── whale/                # TopHoldersPanel, WhaleActivityFeed, WhaleActivityBadge
├── hooks/
│   ├── useAuth.ts            # Authentication hook
│   ├── usePriceStream.ts     # SSE connection hook
│   ├── useRisk.ts            # Risk data hook
│   ├── useSubscription.ts    # Subscription status hook
│   ├── useTokens.ts          # Token data hook
│   └── useWatchlist.ts       # Watchlist management hook
├── lib/
│   ├── api/                  # External API clients
│   │   └── whale.ts          # Whale data (holders, activity)
│   ├── db/                   # Supabase clients + helpers
│   ├── risk/                 # Risk analysis engine
│   ├── stripe/               # Stripe client + config
│   └── utils/                # Formatters, helpers
├── stores/                   # Zustand state stores
│   ├── chartGrid.ts          # Chart grid state
│   ├── filters.ts            # Filter state
│   ├── theme.ts              # Theme state
│   ├── tokens.ts             # Token data state
│   ├── ui.ts                 # UI state
│   └── watchlist.ts          # Watchlist state
├── types/                    # TypeScript definitions
│   ├── whale.ts              # Whale tracking types
│   └── ...
└── middleware.ts             # Auth session refresh
```

## Database Schema

```sql
-- User watchlists
user_watchlists (user_id, token_address, chain_id)

-- User subscriptions
user_subscriptions (
  user_id, stripe_customer_id, stripe_subscription_id,
  tier, status, current_period_start, current_period_end
)

-- Token data (cached)
tokens, token_metrics, risk_scores, pools
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (for auth + database)
- Stripe account (for subscriptions)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/nullcheck.git
cd nullcheck

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Run database migrations
npx supabase db push

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Environment Variables

Create a `.env.local` file with:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Risk Analysis APIs
GOPLUS_API_KEY=your_goplus_key
TOKENSNIFFER_API_KEY=your_tokensniffer_key

# RPC Providers (optional, enhances data)
HELIUS_API_KEY=your_helius_key
ALCHEMY_API_KEY=your_alchemy_key

# Stripe (for subscriptions)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional
RATE_LIMIT_REQUESTS_PER_MINUTE=60
```

### Stripe Setup

1. Create a product "nullcheck PRO" in Stripe Dashboard
2. Create prices: $5/month and $39/year (recurring)
3. Configure Customer Portal settings
4. Add webhook endpoint: `https://yoursite.com/api/stripe/webhook`
5. Select events: `customer.subscription.*`

For local development:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Roadmap

### Completed
- [x] Token table with real-time data
- [x] Multi-chain support (ETH, Base, Solana)
- [x] GoPlus risk integration
- [x] Search and filtering
- [x] Terminal UI with SF Mono
- [x] SSE price streaming
- [x] Supabase database layer
- [x] User authentication (magic link)
- [x] Watchlist functionality
- [x] Multi-chart grid view
- [x] Token detail pages
- [x] Dark/light theme toggle
- [x] PRO subscription system
- [x] Whale tracking (top holders, activity feed)

### In Progress
- [ ] Price alerts (Telegram/Discord)
- [ ] Trending algorithm (organic, time-weighted)

### Planned
- [ ] Additional chains (Arbitrum, Polygon)
- [ ] Shared watchlists
- [ ] Token notes/comments
- [ ] Risk score history
- [ ] Mobile app

## Design Principles

### Visual Language
- **Monochrome palette**: Blacks (#000000), grays (#333-#666), white (#ffffff) accents
- **Emerald highlights**: PRO features and success states (#10b981)
- **Dense data**: Maximize information per pixel
- **No decoration**: Every element serves a purpose
- **Terminal heritage**: Inspired by Bloomberg terminals and trading CLIs

### Typography
- **Font**: SF Mono across all text
- **Hierarchy**: Size and opacity, not weight
- **Numbers**: Tabular figures for aligned columns

### Interactions
- **Hover states**: Subtle brightness changes
- **Click feedback**: Immediate, no animations
- **Loading**: Skeleton screens, not spinners

## API Rate Limits

The app is designed to minimize API calls:

| API | Rate Limit | Our Usage |
|-----|------------|-----------|
| DexScreener | 300/min | ~10/min (cached) |
| GoPlus | 30/min | On-demand only |
| GeckoTerminal | 30/min | Backup only |

## Contributing

Contributions are welcome. Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- TypeScript strict mode
- Functional components with hooks
- Tailwind for all styling (no CSS modules)
- Descriptive variable names over comments

## License

MIT License. See [LICENSE](LICENSE) for details.

---

**null//check** — Because you should know if you can sell before you buy.
