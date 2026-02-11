-- null//check Initial Database Schema
-- Phase 1: Core + Risk tables

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Chains table
CREATE TABLE chains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  rpc_url TEXT NOT NULL,
  explorer_url TEXT NOT NULL,
  is_evm BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert supported chains
INSERT INTO chains (id, name, symbol, rpc_url, explorer_url, is_evm) VALUES
  ('ethereum', 'Ethereum', 'ETH', 'https://eth.drpc.org', 'https://etherscan.io', true),
  ('base', 'Base', 'ETH', 'https://mainnet.base.org', 'https://basescan.org', true),
  ('solana', 'Solana', 'SOL', 'https://api.mainnet-beta.solana.com', 'https://solscan.io', false);

-- Tokens table
CREATE TABLE tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  address TEXT NOT NULL,
  chain_id TEXT NOT NULL REFERENCES chains(id),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  decimals INTEGER DEFAULT 18,
  logo_url TEXT,
  total_supply TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(address, chain_id)
);

-- Token metrics table (updated frequently)
CREATE TABLE token_metrics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  token_address TEXT NOT NULL,
  chain_id TEXT NOT NULL REFERENCES chains(id),
  price DECIMAL(30, 18) DEFAULT 0,
  price_change_1h DECIMAL(10, 4) DEFAULT 0,
  price_change_24h DECIMAL(10, 4) DEFAULT 0,
  price_change_7d DECIMAL(10, 4) DEFAULT 0,
  volume_24h DECIMAL(30, 2) DEFAULT 0,
  liquidity DECIMAL(30, 2) DEFAULT 0,
  market_cap DECIMAL(30, 2),
  fdv DECIMAL(30, 2),
  holders INTEGER,
  txns_24h INTEGER,
  buys_24h INTEGER,
  sells_24h INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(token_address, chain_id)
);

-- Risk scores table
CREATE TABLE risk_scores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  token_address TEXT NOT NULL,
  chain_id TEXT NOT NULL REFERENCES chains(id),
  total_score INTEGER NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),

  -- Liquidity risk
  liquidity_score INTEGER DEFAULT 0,
  liquidity_usd DECIMAL(30, 2) DEFAULT 0,
  lp_locked BOOLEAN DEFAULT false,
  lp_locked_percent DECIMAL(5, 2) DEFAULT 0,

  -- Holder risk
  holder_score INTEGER DEFAULT 0,
  total_holders INTEGER DEFAULT 0,
  top_10_percent DECIMAL(5, 2) DEFAULT 0,
  creator_percent DECIMAL(5, 2) DEFAULT 0,

  -- Contract risk
  contract_score INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  is_renounced BOOLEAN DEFAULT false,
  has_mint BOOLEAN DEFAULT false,
  has_pause BOOLEAN DEFAULT false,
  has_blacklist BOOLEAN DEFAULT false,
  max_tax_percent DECIMAL(5, 2) DEFAULT 0,

  -- Honeypot risk
  honeypot_score INTEGER DEFAULT 0,
  is_honeypot BOOLEAN DEFAULT false,
  buy_tax DECIMAL(5, 2) DEFAULT 0,
  sell_tax DECIMAL(5, 2) DEFAULT 0,
  cannot_sell BOOLEAN DEFAULT false,

  -- Warnings stored as JSONB
  warnings JSONB DEFAULT '[]'::JSONB,

  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour'),

  UNIQUE(token_address, chain_id)
);

-- Pools table
CREATE TABLE pools (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  address TEXT NOT NULL,
  chain_id TEXT NOT NULL REFERENCES chains(id),
  dex TEXT NOT NULL,
  base_token_address TEXT NOT NULL,
  quote_token_address TEXT NOT NULL,
  liquidity DECIMAL(30, 2) DEFAULT 0,
  volume_24h DECIMAL(30, 2) DEFAULT 0,
  lp_locked BOOLEAN DEFAULT false,
  lp_locked_percent DECIMAL(5, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(address, chain_id)
);

-- Indexes for common queries
CREATE INDEX idx_tokens_chain ON tokens(chain_id);
CREATE INDEX idx_tokens_symbol ON tokens(symbol);
CREATE INDEX idx_tokens_updated ON tokens(updated_at DESC);

CREATE INDEX idx_metrics_chain ON token_metrics(chain_id);
CREATE INDEX idx_metrics_liquidity ON token_metrics(liquidity DESC);
CREATE INDEX idx_metrics_volume ON token_metrics(volume_24h DESC);
CREATE INDEX idx_metrics_updated ON token_metrics(updated_at DESC);

CREATE INDEX idx_risk_chain ON risk_scores(chain_id);
CREATE INDEX idx_risk_level ON risk_scores(risk_level);
CREATE INDEX idx_risk_score ON risk_scores(total_score);
CREATE INDEX idx_risk_expires ON risk_scores(expires_at);

CREATE INDEX idx_pools_chain ON pools(chain_id);
CREATE INDEX idx_pools_dex ON pools(dex);
CREATE INDEX idx_pools_base_token ON pools(base_token_address);
CREATE INDEX idx_pools_volume ON pools(volume_24h DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER tokens_updated_at
  BEFORE UPDATE ON tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER token_metrics_updated_at
  BEFORE UPDATE ON token_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER pools_updated_at
  BEFORE UPDATE ON pools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS Policies (basic read-only for anon)
ALTER TABLE chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;

-- Allow read access to all tables for anonymous users
CREATE POLICY "Allow read access to chains" ON chains FOR SELECT USING (true);
CREATE POLICY "Allow read access to tokens" ON tokens FOR SELECT USING (true);
CREATE POLICY "Allow read access to token_metrics" ON token_metrics FOR SELECT USING (true);
CREATE POLICY "Allow read access to risk_scores" ON risk_scores FOR SELECT USING (true);
CREATE POLICY "Allow read access to pools" ON pools FOR SELECT USING (true);
