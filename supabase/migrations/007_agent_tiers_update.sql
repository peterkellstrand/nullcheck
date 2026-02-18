-- Migration: 007_agent_tiers_update.sql
-- Update agent tier names and add stripe subscription linking
-- Created: 2024

-- ============================================================================
-- 1. Update tier names from old to new
-- ============================================================================

-- First, drop the existing constraint
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_tier_check;

-- Update existing tier values
UPDATE public.api_keys SET tier = 'developer' WHERE tier = 'starter';
UPDATE public.api_keys SET tier = 'professional' WHERE tier = 'builder';
UPDATE public.api_keys SET tier = 'business' WHERE tier = 'scale';

-- Add new constraint with updated tier names
ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_tier_check
  CHECK (tier IN ('developer', 'professional', 'business', 'enterprise'));

-- ============================================================================
-- 2. Add Stripe subscription linking to API keys
-- ============================================================================

-- Link API keys to Stripe subscriptions for billing
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS monthly_limit INTEGER DEFAULT 10000;

-- Index for looking up keys by subscription
CREATE INDEX IF NOT EXISTS idx_api_keys_stripe_sub
  ON public.api_keys(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ============================================================================
-- 3. Update API key limit trigger for agent tiers
-- ============================================================================

CREATE OR REPLACE FUNCTION check_api_key_limit()
RETURNS TRIGGER AS $$
DECLARE
  key_count INTEGER;
  max_keys INTEGER;
  has_agent_sub BOOLEAN;
BEGIN
  -- Count existing active keys
  SELECT COUNT(*) INTO key_count
  FROM api_keys
  WHERE user_id = NEW.user_id
    AND is_revoked = FALSE
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

  -- Check if user has an agent subscription (key with stripe_subscription_id)
  SELECT EXISTS(
    SELECT 1 FROM api_keys
    WHERE user_id = NEW.user_id
      AND stripe_subscription_id IS NOT NULL
      AND is_revoked = FALSE
  ) INTO has_agent_sub;

  -- Set limits based on subscription type
  -- Agent subscribers can have up to 10 keys
  -- Users without agent subscription can have 1 key (for testing)
  max_keys := CASE
    WHEN has_agent_sub OR NEW.stripe_subscription_id IS NOT NULL THEN 10
    ELSE 1
  END;

  IF key_count >= max_keys THEN
    RAISE EXCEPTION 'API key limit reached (max: %). Subscribe to an API tier to create more keys.',
      max_keys;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Function to set monthly limit based on tier
-- ============================================================================

CREATE OR REPLACE FUNCTION set_api_key_monthly_limit()
RETURNS TRIGGER AS $$
BEGIN
  NEW.monthly_limit := CASE NEW.tier
    WHEN 'developer' THEN 10000
    WHEN 'professional' THEN 100000
    WHEN 'business' THEN 500000
    WHEN 'enterprise' THEN 999999999  -- Effectively unlimited
    ELSE 10000
  END;

  -- Also set daily_limit as monthly/30 for backwards compatibility
  NEW.daily_limit := CEIL(NEW.monthly_limit::NUMERIC / 30);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_api_key_limits ON public.api_keys;
CREATE TRIGGER set_api_key_limits
  BEFORE INSERT OR UPDATE OF tier ON public.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION set_api_key_monthly_limit();
