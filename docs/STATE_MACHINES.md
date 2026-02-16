# null//check State Machine Diagrams

This document describes the various state machines that govern the behavior of null//check.

---

## 1. User Authentication State Machine

```mermaid
stateDiagram-v2
    [*] --> Anonymous: App Load

    Anonymous --> AuthModalOpen: Click Sign In
    AuthModalOpen --> Anonymous: Close Modal
    AuthModalOpen --> EmailSent: Submit Email

    EmailSent --> Anonymous: Cancel
    EmailSent --> Authenticating: Click Magic Link

    Authenticating --> Authenticated: Success
    Authenticating --> Anonymous: Failure/Expired

    Authenticated --> Anonymous: Sign Out
    Authenticated --> Authenticated: Session Refresh

    Anonymous --> Anonymous: Browse (Limited)
    Authenticated --> Authenticated: Browse (Full Access)
```

### States

| State | Description |
|-------|-------------|
| `Anonymous` | User not logged in, limited features |
| `AuthModalOpen` | Authentication modal displayed |
| `EmailSent` | Magic link email sent, waiting for click |
| `Authenticating` | Verifying magic link token |
| `Authenticated` | User logged in with valid session |

### Transitions

| From | To | Trigger |
|------|-----|---------|
| Anonymous | AuthModalOpen | User clicks "Sign In" |
| AuthModalOpen | EmailSent | User submits email |
| EmailSent | Authenticating | User clicks magic link |
| Authenticating | Authenticated | Token valid |
| Authenticated | Anonymous | User signs out or session expires |

---

## 2. Subscription State Machine

```mermaid
stateDiagram-v2
    [*] --> Free: New User

    Free --> CheckoutPending: Click Subscribe
    CheckoutPending --> Free: Cancel Checkout
    CheckoutPending --> Processing: Complete Payment

    Processing --> Pro: Payment Success
    Processing --> Free: Payment Failed

    Pro --> Pro: Renewal Success
    Pro --> PastDue: Renewal Failed
    Pro --> Canceling: Request Cancel

    PastDue --> Pro: Payment Retry Success
    PastDue --> Free: Grace Period Expired

    Canceling --> Free: Period Ends
    Canceling --> Pro: Reactivate

    Pro --> PortalOpen: Manage Subscription
    PortalOpen --> Pro: Close Portal
```

### States

| State | Description |
|-------|-------------|
| `Free` | Default tier, limited features |
| `CheckoutPending` | User in Stripe checkout flow |
| `Processing` | Payment being processed |
| `Pro` | Active PRO subscription |
| `PastDue` | Payment failed, in grace period |
| `Canceling` | Subscription set to cancel at period end |
| `PortalOpen` | Stripe customer portal open |

### Feature Access by State

| Feature | Free | Pro | PastDue | Canceling |
|---------|------|-----|---------|-----------|
| Watchlist Tokens | 10 | ∞ | ∞ | ∞ |
| Chart Slots | 4 | 16 | 16 | 16 |
| Alerts | 3 | ∞ | ∞ | ∞ |
| Top Holders | 5 | 20 | 20 | 20 |
| API Keys | ✗ | ✓ | ✓ | ✓ |

---

## 3. Token Data State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle: Component Mount

    Idle --> Fetching: Request Tokens

    Fetching --> Loaded: Success
    Fetching --> Error: Failure

    Error --> Fetching: Retry
    Error --> Idle: Reset

    Loaded --> Streaming: SSE Connected
    Loaded --> Fetching: Manual Refresh

    Streaming --> Streaming: Price Update
    Streaming --> Loaded: SSE Disconnected
    Streaming --> Fetching: Manual Refresh

    Loaded --> AnalyzingRisk: Fetch Risk Scores
    AnalyzingRisk --> Loaded: Risk Complete

    Streaming --> AnalyzingRisk: Fetch Risk Scores
    AnalyzingRisk --> Streaming: Risk Complete
```

### States

| State | Description |
|-------|-------------|
| `Idle` | Initial state, no data loaded |
| `Fetching` | API request in progress |
| `Loaded` | Token data loaded, no live updates |
| `Streaming` | SSE connected, receiving live updates |
| `AnalyzingRisk` | Batch risk analysis in progress |
| `Error` | Request failed |

### Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  API Call   │────▶│   Tokens    │────▶│   Zustand   │
│  /api/tokens│     │   Store     │     │    State    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  SSE Stream │
                    │ /api/stream │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Price Flash │
                    │  Animation  │
                    └─────────────┘
```

---

## 4. API Key State Machine

```mermaid
stateDiagram-v2
    [*] --> NoKeys: PRO User First Visit

    NoKeys --> Creating: Click Create Key
    Creating --> NoKeys: Cancel
    Creating --> KeyCreated: Success

    KeyCreated --> HasKeys: Dismiss/Copy
    HasKeys --> HasKeys: Create Another

    HasKeys --> Revoking: Click Revoke
    Revoking --> HasKeys: Confirm Revoke
    Revoking --> HasKeys: Cancel Revoke

    HasKeys --> NoKeys: All Keys Revoked
```

### States

| State | Description |
|-------|-------------|
| `NoKeys` | User has no active API keys |
| `Creating` | Create key form active |
| `KeyCreated` | New key created, showing secret |
| `HasKeys` | User has one or more active keys |
| `Revoking` | Revocation confirmation pending |

### API Key Lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Create  │────▶│  Active  │────▶│  Revoked │────▶│ Deleted  │
│          │     │          │     │          │     │(Soft Del)│
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                      │
                      ▼
                ┌──────────┐
                │   Used   │
                │ (Update  │
                │last_used)│
                └──────────┘
```

---

## 5. API Request State Machine (Agent Access)

```mermaid
stateDiagram-v2
    [*] --> Received: API Request

    Received --> ValidatingKey: Has API Key
    Received --> ValidatingSession: No API Key

    ValidatingKey --> Unauthorized: Invalid/Revoked Key
    ValidatingKey --> CheckingLimit: Valid Key

    CheckingLimit --> RateLimited: Limit Exceeded
    CheckingLimit --> Processing: Within Limit

    ValidatingSession --> Unauthorized: No Session
    ValidatingSession --> Processing: Valid Session

    Processing --> Success: Request Complete
    Processing --> ServerError: Request Failed

    Success --> [*]: Return Response
    Unauthorized --> [*]: Return 401
    RateLimited --> [*]: Return 429
    ServerError --> [*]: Return 500
```

### States

| State | Description |
|-------|-------------|
| `Received` | Request received by server |
| `ValidatingKey` | Checking API key validity |
| `ValidatingSession` | Checking user session |
| `CheckingLimit` | Verifying daily usage limit |
| `Processing` | Executing request logic |
| `Success` | Request completed successfully |
| `Unauthorized` | Authentication failed |
| `RateLimited` | Daily limit exceeded |
| `ServerError` | Internal error occurred |

### Response Codes

| Code | State | Description |
|------|-------|-------------|
| 200 | Success | Request successful |
| 401 | Unauthorized | Invalid credentials |
| 429 | RateLimited | Too many requests |
| 500 | ServerError | Internal error |

---

## 6. Theme State Machine

```mermaid
stateDiagram-v2
    [*] --> CheckingStorage: App Load

    CheckingStorage --> Dark: No Preference / Dark Stored
    CheckingStorage --> Light: Light Stored

    Dark --> Light: Toggle Theme
    Light --> Dark: Toggle Theme

    Dark --> Dark: Persist to localStorage
    Light --> Light: Persist to localStorage
```

### States

| State | Description |
|-------|-------------|
| `CheckingStorage` | Reading localStorage on load |
| `Dark` | Dark theme active (default) |
| `Light` | Light theme active |

### CSS Variables by Theme

| Variable | Dark | Light |
|----------|------|-------|
| `--bg-primary` | #000000 | #EDEBE6 |
| `--bg-secondary` | #0a0a0a | #E5E3DE |
| `--text-primary` | #d0d0d0 | #1A1A1A |
| `--border` | #333333 | #1A1A1A |

---

## 7. Risk Analysis State Machine

```mermaid
stateDiagram-v2
    [*] --> Pending: Token Loaded

    Pending --> Analyzing: Request Analysis

    Analyzing --> Fetching_GoPlus: EVM Chain
    Analyzing --> Fetching_Helius: Solana Chain

    Fetching_GoPlus --> Scoring: Data Received
    Fetching_Helius --> Scoring: Data Received

    Fetching_GoPlus --> Fallback: API Error
    Fetching_Helius --> Fallback: API Error

    Fallback --> Scoring: Use Heuristics

    Scoring --> Complete: Score Calculated

    Complete --> Cached: Store Result
    Cached --> Complete: Cache Hit (Future Request)
```

### Risk Score Calculation

```
┌─────────────────────────────────────────────────────────┐
│                    Total Risk Score                      │
├─────────────┬─────────────┬─────────────┬──────────────┤
│  Honeypot   │  Contract   │   Holders   │  Liquidity   │
│  (0-50pts)  │  (0-30pts)  │  (0-25pts)  │  (0-25pts)   │
└─────────────┴─────────────┴─────────────┴──────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │     Risk Level         │
              │  LOW: 0-14             │
              │  MEDIUM: 15-29         │
              │  HIGH: 30-49           │
              │  CRITICAL: 50+         │
              └────────────────────────┘
```

---

## 8. Watchlist State Machine

```mermaid
stateDiagram-v2
    [*] --> Empty: Authenticated User

    Empty --> Adding: Star Token
    Adding --> HasTokens: Success
    Adding --> Empty: Failure

    HasTokens --> Adding: Star Another
    HasTokens --> Removing: Unstar Token

    Removing --> HasTokens: Success (tokens remain)
    Removing --> Empty: Success (last token)
    Removing --> HasTokens: Failure

    HasTokens --> LimitReached: At Tier Limit
    LimitReached --> HasTokens: Remove Token
    LimitReached --> HasTokens: Upgrade to PRO
```

### States

| State | Description |
|-------|-------------|
| `Empty` | No tokens in watchlist |
| `Adding` | Adding token to watchlist |
| `HasTokens` | Watchlist has tokens |
| `Removing` | Removing token from watchlist |
| `LimitReached` | At tier limit (Free: 10, Pro: ∞) |

---

## 9. Chart Grid State Machine

```mermaid
stateDiagram-v2
    [*] --> Empty: Page Load

    Empty --> HasCharts: Add Token

    HasCharts --> HasCharts: Add Token (under limit)
    HasCharts --> LimitReached: Add Token (at limit)

    LimitReached --> HasCharts: Remove Token
    LimitReached --> LimitReached: Upgrade to PRO

    HasCharts --> Empty: Remove All
    HasCharts --> HasCharts: Change Layout
    HasCharts --> HasCharts: Change Timeframe

    HasCharts --> Loading: Fetch OHLCV
    Loading --> HasCharts: Data Loaded
    Loading --> Error: Fetch Failed
    Error --> Loading: Retry
```

### Chart Limits by Tier

| Tier | Max Charts |
|------|------------|
| Free | 4 |
| PRO | 16 |

---

## 10. Complete Application State Overview

```mermaid
stateDiagram-v2
    [*] --> AppInit

    state AppInit {
        [*] --> LoadTheme
        LoadTheme --> LoadAuth
        LoadAuth --> Ready
    }

    Ready --> Main

    state Main {
        [*] --> TokenList
        TokenList --> TokenDetail: Click Token
        TokenDetail --> TokenList: Back

        TokenList --> Charts: Nav to Charts
        Charts --> TokenList: Nav to Home

        TokenList --> Watchlist: Nav to Watchlist
        Watchlist --> TokenList: Nav to Home

        TokenList --> Pricing: Nav to Pricing
        Pricing --> TokenList: Nav to Home

        TokenList --> APIKeys: Nav to Keys (PRO)
        APIKeys --> TokenList: Nav to Home
    }

    state Background {
        SSE_Stream
        Risk_Analysis
        Session_Refresh
    }
```

---

## State Store Structure (Zustand)

```typescript
// Token Store
interface TokensState {
  tokens: TokenWithMetrics[];
  isLoading: boolean;
  error: string | null;
  setTokens: (tokens: TokenWithMetrics[]) => void;
  updateToken: (address: string, updates: Partial<TokenWithMetrics>) => void;
}

// Theme Store
interface ThemeState {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

// Chart Grid Store
interface ChartGridState {
  tokens: ChartToken[];
  layout: 'auto' | '2x2' | '3x3';
  timeframe: '1h' | '4h' | '1d' | '1w';
  addToken: (token: ChartToken) => void;
  removeToken: (address: string) => void;
  setLayout: (layout: GridLayout) => void;
  setTimeframe: (timeframe: ChartTimeframe) => void;
}

// Filter Store
interface FiltersState {
  chain: ChainId | null;
  sortField: SortField;
  sortDirection: 'asc' | 'desc';
  searchQuery: string;
  setChain: (chain: ChainId | null) => void;
  setSort: (field: SortField, direction: 'asc' | 'desc') => void;
  setSearch: (query: string) => void;
}
```

---

## Event Flow Diagram

```
User Action          Frontend State       API Call           Database
    │                     │                  │                  │
    ▼                     ▼                  ▼                  │
[Click Star] ──────▶ [Optimistic  ] ──────▶ [POST          ] ──┼──▶ [INSERT]
                     [Update UI   ]         [/api/watchlist]   │
                           │                      │            │
                           │◀─────────────────────┘            │
                     [Confirm/     ]◀───────────────────────────┘
                     [Rollback     ]
                           │
                           ▼
                     [Final State  ]
```

---

*Generated for null//check - The risk-first DEX screener*
