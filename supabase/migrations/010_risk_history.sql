-- Migration: 010_risk_history.sql
-- Historical risk score tracking
-- Created: 2026-02

-- ============================================================================
-- 1. RISK SCORE HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.risk_score_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_address TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  total_score INTEGER NOT NULL,
  risk_level TEXT NOT NULL,
  honeypot_score INTEGER,
  contract_score INTEGER,
  holders_score INTEGER,
  liquidity_score INTEGER,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- Main query index: get history for a token ordered by time
CREATE INDEX IF NOT EXISTS idx_risk_history_token
  ON public.risk_score_history(chain_id, token_address, recorded_at DESC);

-- For cleanup: delete old records
CREATE INDEX IF NOT EXISTS idx_risk_history_recorded_at
  ON public.risk_score_history(recorded_at);

-- ============================================================================
-- 3. NO RLS NEEDED
-- ============================================================================
-- This is public data derived from risk scores, no user-specific data

-- ============================================================================
-- 4. CLEANUP FUNCTION
-- ============================================================================

-- Keep 90 days of history
CREATE OR REPLACE FUNCTION cleanup_old_risk_history()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.risk_score_history
  WHERE recorded_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. DEDUPLICATED INSERT FUNCTION
-- ============================================================================

-- Only insert a new record if the score changed or it's been more than 1 hour
CREATE OR REPLACE FUNCTION record_risk_history(
  p_token_address TEXT,
  p_chain_id TEXT,
  p_total_score INTEGER,
  p_risk_level TEXT,
  p_honeypot_score INTEGER DEFAULT NULL,
  p_contract_score INTEGER DEFAULT NULL,
  p_holders_score INTEGER DEFAULT NULL,
  p_liquidity_score INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  last_record RECORD;
  should_insert BOOLEAN := TRUE;
BEGIN
  -- Get the most recent record for this token
  SELECT total_score, recorded_at INTO last_record
  FROM public.risk_score_history
  WHERE chain_id = p_chain_id
    AND token_address = p_token_address
  ORDER BY recorded_at DESC
  LIMIT 1;

  -- Check if we should insert
  IF FOUND THEN
    -- Don't insert if score is the same and less than 1 hour has passed
    IF last_record.total_score = p_total_score
       AND last_record.recorded_at > NOW() - INTERVAL '1 hour' THEN
      should_insert := FALSE;
    END IF;
  END IF;

  IF should_insert THEN
    INSERT INTO public.risk_score_history (
      token_address,
      chain_id,
      total_score,
      risk_level,
      honeypot_score,
      contract_score,
      holders_score,
      liquidity_score
    ) VALUES (
      p_token_address,
      p_chain_id,
      p_total_score,
      p_risk_level,
      p_honeypot_score,
      p_contract_score,
      p_holders_score,
      p_liquidity_score
    );
  END IF;

  RETURN should_insert;
END;
$$ LANGUAGE plpgsql;
