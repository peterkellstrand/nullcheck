-- Add API keys table for agent access
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key TEXT UNIQUE NOT NULL,
  name TEXT,
  tier TEXT DEFAULT 'basic' CHECK (tier IN ('basic', 'pro')),
  daily_limit INTEGER DEFAULT 5000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ,
  is_revoked BOOLEAN DEFAULT FALSE
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api keys" ON public.api_keys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api keys" ON public.api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own api keys" ON public.api_keys
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own api keys" ON public.api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for fast lookup
CREATE INDEX idx_api_keys_key ON public.api_keys(api_key);
CREATE INDEX idx_api_keys_user ON public.api_keys(user_id);

-- Daily usage tracking table
CREATE TABLE IF NOT EXISTS public.api_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  request_count INTEGER DEFAULT 0,
  UNIQUE(api_key_id, date)
);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage api usage" ON public.api_usage
  FOR ALL USING (true);

CREATE INDEX idx_api_usage_key_date ON public.api_usage(api_key_id, date);
