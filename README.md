# null//check

A risk-first DEX screener with a cyberpunk terminal aesthetic. Zero promoted tokens. Organic trending. Honeypot detection first.

## Philosophy

The DEX screener landscape is cluttered with promoted tokens, paid placements, and interfaces that bury critical risk information. null//check takes a different approach:

- **Risk First** — Honeypot detection and rug-pull indicators are prominently displayed, not hidden in submenus
- **Zero Promoted Tokens** — What you see is organic. No paid placements, no "trending" manipulation
- **Dense Information** — Terminal-style UI optimized for power users who need data at a glance
- **Budget Conscious** — Designed to run on $100/month infrastructure, keeping it sustainable and independent

## Features

### Current (Phase 1)

- **Multi-Chain Support** — Ethereum, Base, and Solana tokens in a unified view
- **Real-Time Risk Scoring** — Integrated GoPlus security API for honeypot detection, contract analysis, and holder concentration
- **Live Token Data** — Prices, 1h/24h/7d changes, volume, and liquidity via DexScreener API
- **Sortable Data Grid** — Click any column header to sort by that metric
- **Chain Filtering** — Quickly filter by blockchain
- **Search** — Find tokens by name or symbol
- **Terminal Aesthetic** — Monochrome design with SF Mono typography

### Risk Scoring System

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

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **State**: Zustand + React Query
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
├── app/                    # Next.js App Router
│   ├── api/               # API routes (tokens, risk, stream)
│   ├── page.tsx           # Homepage
│   └── globals.css        # Terminal theme
├── components/
│   ├── tokens/            # TokenTable, TokenRow
│   ├── risk/              # RiskBadge, RiskPanel
│   └── ui/                # Skeleton, Badge, etc.
├── lib/
│   ├── api/               # External API clients
│   ├── risk/              # Risk analysis engine
│   └── utils/             # Formatters, helpers
├── hooks/                 # Custom React hooks
├── stores/                # Zustand state
└── types/                 # TypeScript definitions
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/peterkellstrand/nullcheck.git
cd nullcheck

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Environment Variables

Create a `.env.local` file with:

```env
# Optional: Enhances Solana data
HELIUS_API_KEY=your_helius_key

# Optional: Enhances EVM data
ALCHEMY_API_KEY=your_alchemy_key

# Optional: Database caching (Phase 2)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

> Note: The app works without API keys using public endpoints, but rate limits may apply.

## Roadmap

### Phase 1: Core + Risk (Current)
- [x] Token table with real-time data
- [x] Multi-chain support (ETH, Base, Solana)
- [x] GoPlus risk integration
- [x] Search and filtering
- [x] Terminal UI with SF Mono
- [x] Animated icosahedron branding
- [ ] SSE price streaming
- [ ] Supabase caching layer

### Phase 2: Power Features
- [ ] Token detail pages with charts
- [ ] Watchlist functionality
- [ ] Price alerts (Telegram/Discord)
- [ ] Trending algorithm (organic, time-weighted)
- [ ] Multi-chart grid view
- [ ] Additional chains (Arbitrum, Bonk)

### Phase 3: Community
- [ ] User accounts
- [ ] Shared watchlists
- [ ] Token notes/comments
- [ ] Risk score history

## Design Principles

### Visual Language
- **Monochrome palette**: Blacks (#000000), grays (#333-#666), white (#ffffff) accents
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
