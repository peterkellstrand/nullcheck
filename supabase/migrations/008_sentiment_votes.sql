-- Community sentiment votes for tokens
CREATE TABLE IF NOT EXISTS token_sentiment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint TEXT, -- For anonymous users
  vote TEXT NOT NULL CHECK (vote IN ('bullish', 'bearish')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each user/fingerprint can only vote once per token
  UNIQUE(token_address, chain_id, user_id),
  UNIQUE(token_address, chain_id, fingerprint)
);

-- Index for fast lookups
CREATE INDEX idx_token_sentiment_token ON token_sentiment(chain_id, token_address);
CREATE INDEX idx_token_sentiment_user ON token_sentiment(user_id);

-- Aggregated view for quick sentiment lookup
CREATE OR REPLACE VIEW token_sentiment_summary AS
SELECT
  chain_id,
  token_address,
  COUNT(*) FILTER (WHERE vote = 'bullish') AS bullish_count,
  COUNT(*) FILTER (WHERE vote = 'bearish') AS bearish_count,
  COUNT(*) AS total_votes,
  ROUND(
    COUNT(*) FILTER (WHERE vote = 'bullish')::numeric /
    NULLIF(COUNT(*), 0) * 100,
    1
  ) AS bullish_percent
FROM token_sentiment
GROUP BY chain_id, token_address;

-- RLS policies
ALTER TABLE token_sentiment ENABLE ROW LEVEL SECURITY;

-- Anyone can read sentiment
CREATE POLICY "Anyone can read sentiment" ON token_sentiment
  FOR SELECT USING (true);

-- Logged in users can insert/update their own votes
CREATE POLICY "Users can vote" ON token_sentiment
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR
    (auth.uid() IS NULL AND fingerprint IS NOT NULL)
  );

CREATE POLICY "Users can update their vote" ON token_sentiment
  FOR UPDATE USING (
    auth.uid() = user_id OR
    (auth.uid() IS NULL AND fingerprint IS NOT NULL)
  );

-- Function to update timestamp on vote change
CREATE OR REPLACE FUNCTION update_sentiment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sentiment_updated
  BEFORE UPDATE ON token_sentiment
  FOR EACH ROW
  EXECUTE FUNCTION update_sentiment_timestamp();
