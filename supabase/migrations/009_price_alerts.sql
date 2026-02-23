-- Migration: 009_price_alerts.sql
-- Price alerts for users
-- Created: 2026-02

-- ============================================================================
-- 1. PRICE ALERTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.price_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  chain_id TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_name TEXT,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('price_above', 'price_below')),
  target_price DECIMAL NOT NULL,
  created_price DECIMAL NOT NULL,
  is_triggered BOOLEAN DEFAULT FALSE,
  triggered_at TIMESTAMPTZ,
  triggered_price DECIMAL,
  notification_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate alerts for same condition
  UNIQUE(user_id, chain_id, token_address, alert_type, target_price)
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- For user's alerts list (sorted by creation)
CREATE INDEX IF NOT EXISTS idx_price_alerts_user
  ON public.price_alerts(user_id, is_triggered, created_at DESC);

-- For cron job: find active alerts by token
CREATE INDEX IF NOT EXISTS idx_price_alerts_active
  ON public.price_alerts(chain_id, token_address)
  WHERE is_triggered = FALSE;

-- For finding alerts pending notification
CREATE INDEX IF NOT EXISTS idx_price_alerts_pending_notification
  ON public.price_alerts(is_triggered, notification_sent)
  WHERE is_triggered = TRUE AND notification_sent = FALSE;

-- ============================================================================
-- 3. UPDATED_AT TRIGGER
-- ============================================================================

-- Reuse the update_updated_at_column function if it exists, otherwise create it
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_price_alerts_updated_at
  BEFORE UPDATE ON public.price_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

-- Users can view their own alerts
CREATE POLICY "Users can view own price alerts"
  ON public.price_alerts
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can create their own alerts
CREATE POLICY "Users can create own price alerts"
  ON public.price_alerts
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own alerts
CREATE POLICY "Users can update own price alerts"
  ON public.price_alerts
  FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own alerts
CREATE POLICY "Users can delete own price alerts"
  ON public.price_alerts
  FOR DELETE
  USING (user_id = auth.uid());

-- Service role has full access (for cron jobs)
CREATE POLICY "Service role full access price_alerts"
  ON public.price_alerts
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 5. CLEANUP FUNCTION
-- ============================================================================

-- Cleanup old triggered alerts (keep for 30 days after triggering)
CREATE OR REPLACE FUNCTION cleanup_old_price_alerts()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.price_alerts
  WHERE is_triggered = TRUE
    AND triggered_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
