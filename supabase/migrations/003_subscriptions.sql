-- Subscription tiers and status enums
CREATE TYPE subscription_tier AS ENUM ('free', 'pro');
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'trialing');

-- User subscriptions table
CREATE TABLE user_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  tier subscription_tier NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes for efficient lookups
CREATE INDEX idx_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_sub ON user_subscriptions(stripe_subscription_id);

-- Updated_at trigger
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only view their own subscription
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert/update (via webhook)
CREATE POLICY "Service role can manage subscriptions"
  ON user_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
