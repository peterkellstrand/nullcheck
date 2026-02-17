-- Migration: Trending tokens materialized view
-- This creates a pre-computed view of trending tokens for fast API responses

-- ============================================================================
-- MATERIALIZED VIEW: trending_tokens_mv
-- Pre-computed join of tokens, metrics, and risk scores for fast querying
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS trending_tokens_mv AS
SELECT
  t.address,
  t.chain_id,
  t.symbol,
  t.name,
  t.logo_url,
  t.decimals,
  m.price,
  m.price_change_1h,
  m.price_change_24h,
  m.volume_24h,
  m.liquidity,
  m.market_cap,
  m.fdv,
  m.txns_24h,
  m.buys_24h,
  m.sells_24h,
  m.updated_at AS metrics_updated_at,
  r.total_score AS risk_score,
  r.risk_level,
  r.is_honeypot,
  r.analyzed_at AS risk_analyzed_at
FROM tokens t
INNER JOIN token_metrics m
  ON t.address = m.token_address
  AND t.chain_id = m.chain_id
LEFT JOIN risk_scores r
  ON t.address = r.token_address
  AND t.chain_id = r.chain_id
WHERE m.volume_24h > 1000  -- Minimum volume threshold
  AND m.liquidity > 1000   -- Minimum liquidity threshold
ORDER BY m.volume_24h DESC
LIMIT 1000;  -- Keep top 1000 tokens

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS trending_tokens_mv_pk
  ON trending_tokens_mv (chain_id, address);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS trending_tokens_mv_volume_idx
  ON trending_tokens_mv (volume_24h DESC);

CREATE INDEX IF NOT EXISTS trending_tokens_mv_chain_idx
  ON trending_tokens_mv (chain_id);

CREATE INDEX IF NOT EXISTS trending_tokens_mv_risk_idx
  ON trending_tokens_mv (risk_score DESC NULLS LAST);

-- ============================================================================
-- FUNCTION: refresh_trending_tokens
-- Refreshes the materialized view (can be called by cron job)
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_trending_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Use CONCURRENTLY to avoid blocking reads during refresh
  -- Note: Requires the unique index created above
  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_tokens_mv;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION refresh_trending_tokens() TO service_role;

-- ============================================================================
-- VIEW: trending_tokens_by_chain
-- Helper view for chain-specific trending tokens
-- ============================================================================

CREATE OR REPLACE VIEW trending_tokens_by_chain AS
SELECT
  chain_id,
  COUNT(*) AS token_count,
  SUM(volume_24h) AS total_volume,
  AVG(risk_score) AS avg_risk_score
FROM trending_tokens_mv
GROUP BY chain_id;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON MATERIALIZED VIEW trending_tokens_mv IS
  'Pre-computed trending tokens for fast API responses. Refresh every 5 minutes.';

COMMENT ON FUNCTION refresh_trending_tokens() IS
  'Refreshes the trending_tokens_mv materialized view concurrently.';
