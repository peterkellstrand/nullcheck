-- Migration: 005_agent_optimizations.sql
-- Optimizations for AI agent API access
-- Created: 2024-01

-- ============================================================================
-- 1. SECURITY: Hash API keys instead of plain text
-- ============================================================================

-- Enable pgcrypto for hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add hashed_key and key_prefix columns
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS hashed_key TEXT,
  ADD COLUMN IF NOT EXISTS key_prefix TEXT;

-- Function to hash API keys using SHA-256
CREATE OR REPLACE FUNCTION hash_api_key(key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(key, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Migrate existing keys (if any exist with plain text)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'api_key'
  ) THEN
    UPDATE public.api_keys
    SET
      hashed_key = hash_api_key(api_key),
      key_prefix = substring(api_key, 1, 12) || '...'
    WHERE hashed_key IS NULL AND api_key IS NOT NULL;
  END IF;
END $$;

-- Create index on hashed_key for fast lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_hashed
  ON public.api_keys(hashed_key)
  WHERE is_revoked = FALSE;

-- ============================================================================
-- 2. PERFORMANCE: Composite indexes for agent queries
-- ============================================================================

-- Agent query: "Get all high-risk tokens on Ethereum"
CREATE INDEX IF NOT EXISTS idx_risk_chain_level_score
  ON risk_scores(chain_id, risk_level, total_score DESC);

-- Agent query: "Show tokens sorted by volume on a chain"
CREATE INDEX IF NOT EXISTS idx_metrics_chain_volume
  ON token_metrics(chain_id, volume_24h DESC);

-- Agent query: "Get metrics for specific tokens" (covering index)
CREATE INDEX IF NOT EXISTS idx_metrics_lookup
  ON token_metrics(token_address, chain_id);

-- Agent query: "Find pools for a token"
CREATE INDEX IF NOT EXISTS idx_pools_token_lookup
  ON pools(base_token_address, chain_id);

-- API key validation (most common query - partial index for active keys only)
CREATE INDEX IF NOT EXISTS idx_api_keys_validation
  ON public.api_keys(hashed_key, is_revoked, user_id)
  WHERE is_revoked = FALSE;

-- Risk scores by expiration (for cleanup and valid score queries)
CREATE INDEX IF NOT EXISTS idx_risk_expires
  ON risk_scores(expires_at)
  WHERE expires_at IS NOT NULL;

-- ============================================================================
-- 3. RELIABILITY: Idempotency support for retry-safe operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.idempotent_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  idempotency_key TEXT NOT NULL,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE,
  request_path TEXT NOT NULL,
  request_hash TEXT NOT NULL, -- Hash of request body for validation
  response_data JSONB NOT NULL,
  status_code INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  UNIQUE(idempotency_key, api_key_id)
);

CREATE INDEX IF NOT EXISTS idx_idempotent_key
  ON public.idempotent_requests(idempotency_key, api_key_id);
CREATE INDEX IF NOT EXISTS idx_idempotent_expires
  ON public.idempotent_requests(expires_at);

-- ============================================================================
-- 4. OBSERVABILITY: Webhook events logging
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL, -- 'stripe', 'coinbase', etc.
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE(provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_type
  ON public.webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed
  ON public.webhook_events(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider
  ON public.webhook_events(provider, event_id);

-- ============================================================================
-- 5. OBSERVABILITY: API metrics tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.api_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  cached BOOLEAN DEFAULT FALSE,
  request_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_metrics_key_date
  ON public.api_metrics(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_metrics_endpoint
  ON public.api_metrics(endpoint, created_at DESC);

-- ============================================================================
-- 6. AGENT FEATURES: Webhook subscriptions for push notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  events TEXT[] NOT NULL, -- e.g., ['risk_score_high', 'whale_movement', 'price_alert']
  is_active BOOLEAN DEFAULT TRUE,
  secret TEXT NOT NULL, -- For HMAC signature verification
  filters JSONB DEFAULT '{}'::JSONB, -- e.g., {"min_risk_score": 50, "chains": ["ethereum"]}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_triggered TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  UNIQUE(api_key_id, webhook_url)
);

CREATE INDEX IF NOT EXISTS idx_webhooks_active
  ON public.webhook_subscriptions(is_active, api_key_id)
  WHERE is_active = TRUE;

-- Webhook delivery log for debugging
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_code INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_sub
  ON public.webhook_deliveries(subscription_id, delivered_at DESC);

-- ============================================================================
-- 7. AUTOMATION: Cleanup functions for expired data
-- ============================================================================

-- Cleanup expired risk scores (keep for 24h past expiration for debugging)
CREATE OR REPLACE FUNCTION cleanup_expired_risk_scores()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM risk_scores
  WHERE expires_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup expired idempotent requests
CREATE OR REPLACE FUNCTION cleanup_expired_idempotent_requests()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.idempotent_requests
  WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old API metrics (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_api_metrics()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.api_metrics
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old API usage records (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_api_usage()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.api_usage
  WHERE date < CURRENT_DATE - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old webhook deliveries (keep 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_deliveries()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.webhook_deliveries
  WHERE delivered_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Master cleanup function that runs all cleanups
CREATE OR REPLACE FUNCTION run_all_cleanups()
RETURNS TABLE(
  cleanup_name TEXT,
  records_deleted INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'risk_scores'::TEXT, cleanup_expired_risk_scores()
  UNION ALL
  SELECT 'idempotent_requests'::TEXT, cleanup_expired_idempotent_requests()
  UNION ALL
  SELECT 'api_metrics'::TEXT, cleanup_old_api_metrics()
  UNION ALL
  SELECT 'api_usage'::TEXT, cleanup_old_api_usage()
  UNION ALL
  SELECT 'webhook_deliveries'::TEXT, cleanup_old_webhook_deliveries();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. SCALABILITY: Materialized view for trending tokens
-- ============================================================================

-- Drop if exists to allow recreation
DROP MATERIALIZED VIEW IF EXISTS trending_tokens;

CREATE MATERIALIZED VIEW trending_tokens AS
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
  m.txns_24h,
  r.risk_level,
  r.total_score as risk_score,
  m.updated_at
FROM tokens t
JOIN token_metrics m ON t.address = m.token_address AND t.chain_id = m.chain_id
LEFT JOIN risk_scores r ON t.address = r.token_address AND t.chain_id = r.chain_id
  AND (r.expires_at IS NULL OR r.expires_at > NOW())
WHERE m.volume_24h > 1000
ORDER BY m.volume_24h DESC
LIMIT 200;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trending_unique
  ON trending_tokens(address, chain_id);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_trending_tokens()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_tokens;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. ENFORCEMENT: API key limits by subscription tier
-- ============================================================================

CREATE OR REPLACE FUNCTION check_api_key_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_tier TEXT;
  key_count INTEGER;
  max_keys INTEGER;
BEGIN
  -- Get user's subscription tier
  SELECT tier INTO user_tier
  FROM user_subscriptions
  WHERE user_id = NEW.user_id
    AND status = 'active';

  -- Default to free if no active subscription
  user_tier := COALESCE(user_tier, 'free');

  -- Count existing active keys
  SELECT COUNT(*) INTO key_count
  FROM api_keys
  WHERE user_id = NEW.user_id
    AND is_revoked = FALSE
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

  -- Set limits by tier
  max_keys := CASE user_tier
    WHEN 'pro' THEN 10
    WHEN 'free' THEN 1
    ELSE 1
  END;

  IF key_count >= max_keys THEN
    RAISE EXCEPTION 'API key limit reached for % tier (max: %). Upgrade to create more keys.',
      user_tier, max_keys;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS enforce_api_key_limit ON public.api_keys;
CREATE TRIGGER enforce_api_key_limit
  BEFORE INSERT ON public.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION check_api_key_limit();

-- ============================================================================
-- 10. FIX: Add missing update_updated_at_column function
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger to webhook_subscriptions
CREATE TRIGGER update_webhook_subscriptions_updated_at
  BEFORE UPDATE ON public.webhook_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 11. RLS POLICIES for new tables
-- ============================================================================

-- Enable RLS
ALTER TABLE public.idempotent_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Webhook events: only service role can access
CREATE POLICY "Service role only for webhook_events"
  ON public.webhook_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- Idempotent requests: users can see their own via API key
CREATE POLICY "Users can view own idempotent requests"
  ON public.idempotent_requests
  FOR SELECT
  USING (
    api_key_id IN (
      SELECT id FROM public.api_keys WHERE user_id = auth.uid()
    )
  );

-- API metrics: users can view their own
CREATE POLICY "Users can view own API metrics"
  ON public.api_metrics
  FOR SELECT
  USING (
    api_key_id IN (
      SELECT id FROM public.api_keys WHERE user_id = auth.uid()
    )
  );

-- Webhook subscriptions: users manage their own
CREATE POLICY "Users can manage own webhook subscriptions"
  ON public.webhook_subscriptions
  FOR ALL
  USING (
    api_key_id IN (
      SELECT id FROM public.api_keys WHERE user_id = auth.uid()
    )
  );

-- Webhook deliveries: users can view their own
CREATE POLICY "Users can view own webhook deliveries"
  ON public.webhook_deliveries
  FOR SELECT
  USING (
    subscription_id IN (
      SELECT id FROM public.webhook_subscriptions
      WHERE api_key_id IN (
        SELECT id FROM public.api_keys WHERE user_id = auth.uid()
      )
    )
  );

-- Service role policies for all tables (needed for API operations)
CREATE POLICY "Service role full access idempotent_requests"
  ON public.idempotent_requests FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access api_metrics"
  ON public.api_metrics FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access webhook_subscriptions"
  ON public.webhook_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access webhook_deliveries"
  ON public.webhook_deliveries FOR ALL
  USING (auth.role() = 'service_role');
