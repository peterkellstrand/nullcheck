-- Watchlist feature schema
-- Depends on: 001_initial_schema.sql

-- User watchlist table
CREATE TABLE user_watchlists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_address TEXT NOT NULL,
  chain_id TEXT NOT NULL REFERENCES chains(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token_address, chain_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_watchlist_user ON user_watchlists(user_id);
CREATE INDEX idx_watchlist_token ON user_watchlists(token_address, chain_id);
CREATE INDEX idx_watchlist_created ON user_watchlists(created_at DESC);

-- Enable RLS
ALTER TABLE user_watchlists ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own watchlist
CREATE POLICY "Users can view own watchlist"
  ON user_watchlists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchlist"
  ON user_watchlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own watchlist"
  ON user_watchlists FOR DELETE
  USING (auth.uid() = user_id);
