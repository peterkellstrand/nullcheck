# NULL//CHECK Remaining Implementation Plan

## Overview

This document outlines the remaining tasks to complete the agent-first API platform, organized by priority and complexity.

---

## Phase 1: Webhook Delivery System (Medium Priority - 4-6 hours)

The database schema exists but no delivery code. This enables agents to receive push notifications.

### Task 1.1: Create Webhook Types
**File:** `src/types/webhook.ts`

```typescript
export type WebhookEventType =
  | 'risk_score_high'      // Token risk score exceeds threshold
  | 'risk_score_critical'  // Token flagged as critical risk
  | 'whale_movement'       // Large transaction detected
  | 'price_alert'          // Price threshold crossed
  | 'new_token'            // New token detected on chain

export interface WebhookSubscription {
  id: string;
  apiKeyId: string;
  webhookUrl: string;
  events: WebhookEventType[];
  isActive: boolean;
  secret: string;
  filters?: {
    chains?: ChainId[];
    minRiskScore?: number;
    minValueUsd?: number;
  };
}

export interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
}
```

### Task 1.2: Create Webhook Service
**File:** `src/lib/webhooks/service.ts`

Implement:
- `getSubscriptionsForEvent(eventType, filters)` - Find matching subscriptions
- `createPayload(event, data)` - Build signed payload
- `signPayload(payload, secret)` - HMAC-SHA256 signature
- `deliverWebhook(subscription, payload)` - HTTP POST with retries
- `logDelivery(subscriptionId, payload, response)` - Record in webhook_deliveries

### Task 1.3: Create Webhook Trigger Functions
**File:** `src/lib/webhooks/triggers.ts`

Implement trigger points:
- `triggerRiskScoreWebhook(tokenAddress, chainId, riskScore)` - Called after risk analysis
- `triggerWhaleWebhook(transaction)` - Called when whale activity detected
- `triggerPriceAlertWebhook(tokenAddress, price, threshold)` - Called on price change

### Task 1.4: Create Webhook Management API
**File:** `src/app/api/webhooks/route.ts`

Endpoints:
- `GET /api/webhooks` - List user's webhook subscriptions
- `POST /api/webhooks` - Create new subscription
- `DELETE /api/webhooks?id=xxx` - Remove subscription

**File:** `src/app/api/webhooks/test/route.ts`
- `POST /api/webhooks/test` - Send test webhook to verify endpoint

### Task 1.5: Integrate Triggers into Existing Code

Add webhook triggers to:
- `src/app/api/risk/[chain]/[address]/route.ts` - After risk calculation
- `src/lib/api/whale.ts` - After whale activity detection

---

## Phase 2: Overage Billing (Medium Priority - 3-4 hours)

Enable usage-based billing beyond tier limits.

### Task 2.1: Add Overage Configuration
**File:** `src/types/subscription.ts`

```typescript
export const OVERAGE_RATES = {
  starter: { pricePerThousand: 0.50, enabled: false },
  builder: { pricePerThousand: 0.25, enabled: true },
  scale: { pricePerThousand: 0.10, enabled: true },
} as const;
```

### Task 2.2: Create Usage Metering Service
**File:** `src/lib/billing/metering.ts`

Implement:
- `recordOverageUsage(apiKeyId, count)` - Track overage requests
- `getMonthlyOverage(apiKeyId)` - Calculate overage for billing period
- `reportUsageToStripe(customerId, quantity)` - Send metered usage

### Task 2.3: Stripe Metered Billing Setup

1. Create metered price in Stripe Dashboard for API overages
2. Update checkout to include metered subscription item
3. Report usage via Stripe Usage Records API

### Task 2.4: Create Billing Summary Endpoint
**File:** `src/app/api/billing/route.ts`

- `GET /api/billing` - Return current billing period usage and projected charges

### Task 2.5: Update Rate Limiter for Soft Limits

Modify `src/lib/auth/verify-api-access.ts`:
- Allow requests beyond daily_limit if overage billing enabled
- Track overage count separately
- Return warning header when in overage

---

## Phase 3: Background Jobs (Lower Priority - 2-3 hours)

Automated maintenance tasks.

### Task 3.1: Create Job Runner Infrastructure
**File:** `src/lib/jobs/runner.ts`

Simple cron-compatible job system:
```typescript
export const JOBS = {
  cleanupWebhookDeliveries: { schedule: '0 3 * * *', handler: cleanupWebhookDeliveries },
  cleanupExpiredCache: { schedule: '*/15 * * * *', handler: cleanupExpiredCache },
  cleanupIdempotentRequests: { schedule: '0 4 * * *', handler: cleanupIdempotentRequests },
  reportDailyUsageToStripe: { schedule: '0 0 * * *', handler: reportDailyUsage },
};
```

### Task 3.2: Create Cleanup Functions
**File:** `src/lib/jobs/cleanup.ts`

Implement:
- `cleanupWebhookDeliveries()` - Delete deliveries > 7 days old
- `cleanupIdempotentRequests()` - Delete requests > 24 hours old
- `cleanupExpiredRiskScores()` - Delete expired risk cache entries

### Task 3.3: Create Cron API Endpoint
**File:** `src/app/api/cron/[job]/route.ts`

- Protected by `CRON_SECRET` environment variable
- Called by Vercel Cron or external scheduler
- Executes job and returns result

### Task 3.4: Configure Vercel Cron
**File:** `vercel.json`

```json
{
  "crons": [
    { "path": "/api/cron/cleanup-webhooks", "schedule": "0 3 * * *" },
    { "path": "/api/cron/report-usage", "schedule": "0 0 * * *" }
  ]
}
```

---

## Phase 4: Trending Tokens Optimization (Lower Priority - 1-2 hours)

Improve performance for trending token queries.

### Task 4.1: Create Materialized View
**File:** `supabase/migrations/006_materialized_views.sql`

```sql
CREATE MATERIALIZED VIEW trending_tokens_mv AS
SELECT
  t.address,
  t.chain_id,
  t.symbol,
  t.name,
  t.logo_url,
  m.price,
  m.price_change_24h,
  m.volume_24h,
  m.liquidity,
  m.market_cap,
  r.total_score as risk_score,
  r.risk_level
FROM tokens t
JOIN token_metrics m ON t.address = m.token_address AND t.chain_id = m.chain_id
LEFT JOIN risk_scores r ON t.address = r.token_address AND t.chain_id = r.chain_id
WHERE m.volume_24h > 10000
ORDER BY m.volume_24h DESC
LIMIT 500;

CREATE UNIQUE INDEX ON trending_tokens_mv (chain_id, address);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_trending_tokens()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_tokens_mv;
END;
$$ LANGUAGE plpgsql;
```

### Task 4.2: Create Refresh Job
Add to cron jobs:
- `refreshTrendingTokens` - Every 5 minutes

### Task 4.3: Update Tokens API
Modify `src/app/api/tokens/route.ts`:
- Query from `trending_tokens_mv` instead of joining tables
- Fall back to regular query if view is stale

---

## Phase 5: Admin Monitoring Dashboard (Lower Priority - 4-6 hours)

Internal dashboard for system health and metrics.

### Task 5.1: Create Admin Auth Middleware
**File:** `src/lib/auth/admin.ts`

- Check user email against `ADMIN_EMAILS` environment variable
- Or check for admin role in database

### Task 5.2: Create Admin API Endpoints
**File:** `src/app/api/admin/stats/route.ts`

Return:
- Total users, active subscriptions, API keys
- Request volume (today, this week, this month)
- Error rates by endpoint
- Cache hit rates
- External API health status

**File:** `src/app/api/admin/users/route.ts`
- List users with subscription status
- Search by email

### Task 5.3: Create Admin Dashboard Page
**File:** `src/app/admin/page.tsx`

Display:
- System health overview (from /api/health)
- Usage charts (daily requests, error rates)
- Active API keys count
- Revenue metrics (from Stripe)
- Recent webhook deliveries status

---

## Phase 6: API Documentation (Lower Priority - 2-3 hours)

OpenAPI spec for developer portal.

### Task 6.1: Create OpenAPI Spec
**File:** `public/openapi.yaml`

Document all endpoints:
- `/api/tokens` - List/search tokens
- `/api/token/{chain}/{address}` - Get token details
- `/api/risk/{chain}/{address}` - Get risk analysis
- `/api/risk/batch` - Batch risk analysis
- `/api/ohlcv/{chain}/{address}` - Price history
- `/api/whale/holders/{chain}/{address}` - Top holders
- `/api/whale/activity/{chain}/{address}` - Whale activity
- `/api/webhooks` - Webhook management
- `/api/usage` - Usage statistics
- `/api/metrics` - Real-time metrics

### Task 6.2: Add Swagger UI
**File:** `src/app/docs/page.tsx`

Embed Swagger UI component to render OpenAPI spec.

### Task 6.3: Add Request/Response Examples

For each endpoint, include:
- Example request (curl, JS fetch)
- Success response
- Error responses
- Rate limit headers explanation

---

## Phase 7: Browser Fingerprinting (Lowest Priority - 2-3 hours)

Abuse prevention for web UI.

### Task 7.1: Add Fingerprinting Library
```bash
npm install @fingerprintjs/fingerprintjs
```

### Task 7.2: Create Fingerprint Context
**File:** `src/components/security/FingerprintProvider.tsx`

- Initialize FingerprintJS on client
- Store visitor ID in context
- Send with API requests as header

### Task 7.3: Create Rate Limit by Fingerprint
**File:** `src/lib/security/fingerprint-limiter.ts`

- Track requests by fingerprint (in-memory or Redis)
- Apply stricter limits for anonymous users
- Block suspicious patterns

### Task 7.4: Update API Middleware
Add fingerprint-based rate limiting to unauthenticated endpoints.

---

## Phase 8: Load Testing (Lowest Priority - 2-3 hours)

Verify system can handle target load.

### Task 8.1: Create k6 Test Scripts
**File:** `tests/load/tokens.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up
    { duration: '3m', target: 50 },   // Steady state
    { duration: '1m', target: 100 },  // Peak
    { duration: '1m', target: 0 },    // Ramp down
  ],
};

export default function() {
  const res = http.get('https://api.nullcheck.io/api/tokens?chain=solana', {
    headers: { 'X-API-Key': __ENV.API_KEY },
  });
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}
```

### Task 8.2: Create Test Scenarios
- `tokens.js` - Token listing endpoint
- `risk-single.js` - Single token risk analysis
- `risk-batch.js` - Batch risk analysis
- `search.js` - Search endpoint
- `mixed.js` - Realistic traffic mix

### Task 8.3: Document Performance Baselines
Record:
- P50, P95, P99 latencies
- Max RPS before degradation
- Error rates under load

---

## Implementation Order (Recommended)

1. **Phase 1: Webhook Delivery** - Highest value for agent users
2. **Phase 2: Overage Billing** - Revenue enablement
3. **Phase 3: Background Jobs** - Operational stability
4. **Phase 4: Trending Optimization** - Performance improvement
5. **Phase 6: API Documentation** - Developer experience
6. **Phase 5: Admin Dashboard** - Internal tooling
7. **Phase 7: Fingerprinting** - Security hardening
8. **Phase 8: Load Testing** - Validation

---

## Estimated Total Time

| Phase | Estimated Hours |
|-------|----------------|
| 1. Webhook Delivery | 4-6 |
| 2. Overage Billing | 3-4 |
| 3. Background Jobs | 2-3 |
| 4. Trending Optimization | 1-2 |
| 5. Admin Dashboard | 4-6 |
| 6. API Documentation | 2-3 |
| 7. Fingerprinting | 2-3 |
| 8. Load Testing | 2-3 |
| **Total** | **20-30 hours** |

---

## Quick Wins (Can do immediately)

1. Create `src/types/webhook.ts` with type definitions
2. Create OpenAPI spec skeleton in `public/openapi.yaml`
3. Add `vercel.json` with cron configuration placeholders
4. Create admin email check middleware
