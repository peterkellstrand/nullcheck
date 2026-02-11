import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ChainId } from '@/types/chain';
import { Token, TokenMetrics, Pool } from '@/types/token';
import { RiskScore, RiskLevel } from '@/types/risk';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Lazy initialization of supabase client
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

// Server-side client with service role
export function createServerClient(): SupabaseClient | null {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey || !supabaseUrl) {
    return null;
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

// Token operations
export async function getToken(
  chainId: ChainId,
  address: string
): Promise<Token | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('tokens')
    .select('*')
    .eq('chain_id', chainId)
    .eq('address', address.toLowerCase())
    .single();

  if (error || !data) return null;

  return {
    address: data.address,
    chainId: data.chain_id as ChainId,
    symbol: data.symbol,
    name: data.name,
    decimals: data.decimals,
    logoUrl: data.logo_url,
    totalSupply: data.total_supply,
    createdAt: data.created_at,
  };
}

export async function upsertToken(token: Token): Promise<void> {
  const db = createServerClient();
  if (!db) return;

  await db.from('tokens').upsert(
    {
      address: token.address.toLowerCase(),
      chain_id: token.chainId,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      logo_url: token.logoUrl,
      total_supply: token.totalSupply,
    },
    { onConflict: 'address,chain_id' }
  );
}

// Token metrics operations
export async function getTokenMetrics(
  chainId: ChainId,
  address: string
): Promise<TokenMetrics | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('token_metrics')
    .select('*')
    .eq('chain_id', chainId)
    .eq('token_address', address.toLowerCase())
    .single();

  if (error || !data) return null;

  return {
    tokenAddress: data.token_address,
    chainId: data.chain_id as ChainId,
    price: parseFloat(data.price) || 0,
    priceChange1h: parseFloat(data.price_change_1h) || 0,
    priceChange24h: parseFloat(data.price_change_24h) || 0,
    priceChange7d: parseFloat(data.price_change_7d) || 0,
    volume24h: parseFloat(data.volume_24h) || 0,
    liquidity: parseFloat(data.liquidity) || 0,
    marketCap: data.market_cap ? parseFloat(data.market_cap) : undefined,
    fdv: data.fdv ? parseFloat(data.fdv) : undefined,
    holders: data.holders,
    txns24h: data.txns_24h,
    buys24h: data.buys_24h,
    sells24h: data.sells_24h,
    updatedAt: data.updated_at,
  };
}

export async function upsertTokenMetrics(metrics: TokenMetrics): Promise<void> {
  const db = createServerClient();
  if (!db) return;

  await db.from('token_metrics').upsert(
    {
      token_address: metrics.tokenAddress.toLowerCase(),
      chain_id: metrics.chainId,
      price: metrics.price,
      price_change_1h: metrics.priceChange1h,
      price_change_24h: metrics.priceChange24h,
      price_change_7d: metrics.priceChange7d,
      volume_24h: metrics.volume24h,
      liquidity: metrics.liquidity,
      market_cap: metrics.marketCap,
      fdv: metrics.fdv,
      holders: metrics.holders,
      txns_24h: metrics.txns24h,
      buys_24h: metrics.buys24h,
      sells_24h: metrics.sells24h,
    },
    { onConflict: 'token_address,chain_id' }
  );
}

// Risk score operations
export async function getRiskScore(
  chainId: ChainId,
  address: string
): Promise<RiskScore | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('risk_scores')
    .select('*')
    .eq('chain_id', chainId)
    .eq('token_address', address.toLowerCase())
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) return null;

  return mapRiskScoreFromDb(data);
}

export async function upsertRiskScore(risk: RiskScore): Promise<void> {
  const db = createServerClient();
  if (!db) return;

  await db.from('risk_scores').upsert(
    {
      token_address: risk.tokenAddress.toLowerCase(),
      chain_id: risk.chainId,
      total_score: risk.totalScore,
      risk_level: risk.level,
      liquidity_score: risk.liquidity.score,
      liquidity_usd: risk.liquidity.liquidity,
      lp_locked: risk.liquidity.lpLocked,
      lp_locked_percent: risk.liquidity.lpLockedPercent,
      holder_score: risk.holders.score,
      total_holders: risk.holders.totalHolders,
      top_10_percent: risk.holders.top10Percent,
      creator_percent: risk.holders.creatorHoldingPercent,
      contract_score: risk.contract.score,
      is_verified: risk.contract.verified,
      is_renounced: risk.contract.renounced,
      has_mint: risk.contract.hasMintFunction,
      has_pause: risk.contract.hasPauseFunction,
      has_blacklist: risk.contract.hasBlacklistFunction,
      max_tax_percent: risk.contract.maxTaxPercent,
      honeypot_score: risk.honeypot.score,
      is_honeypot: risk.honeypot.isHoneypot,
      buy_tax: risk.honeypot.buyTax,
      sell_tax: risk.honeypot.sellTax,
      cannot_sell: risk.honeypot.cannotSell,
      warnings: risk.warnings,
      analyzed_at: risk.analyzedAt,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    },
    { onConflict: 'token_address,chain_id' }
  );
}

// Top tokens query
export async function getTopTokens(
  chainId?: ChainId,
  orderBy: 'volume_24h' | 'liquidity' = 'volume_24h',
  limit: number = 100
): Promise<(Token & { metrics: TokenMetrics })[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  let query = supabase
    .from('token_metrics')
    .select(
      `
      *,
      tokens!inner(*)
    `
    )
    .order(orderBy, { ascending: false })
    .limit(limit);

  if (chainId) {
    query = query.eq('chain_id', chainId);
  }

  const { data, error } = await query;

  if (error || !data) return [];

  return data.map((row) => ({
    address: row.tokens.address,
    chainId: row.chain_id as ChainId,
    symbol: row.tokens.symbol,
    name: row.tokens.name,
    decimals: row.tokens.decimals,
    logoUrl: row.tokens.logo_url,
    totalSupply: row.tokens.total_supply,
    createdAt: row.tokens.created_at,
    metrics: {
      tokenAddress: row.token_address,
      chainId: row.chain_id as ChainId,
      price: parseFloat(row.price) || 0,
      priceChange1h: parseFloat(row.price_change_1h) || 0,
      priceChange24h: parseFloat(row.price_change_24h) || 0,
      priceChange7d: parseFloat(row.price_change_7d) || 0,
      volume24h: parseFloat(row.volume_24h) || 0,
      liquidity: parseFloat(row.liquidity) || 0,
      marketCap: row.market_cap ? parseFloat(row.market_cap) : undefined,
      fdv: row.fdv ? parseFloat(row.fdv) : undefined,
      holders: row.holders,
      txns24h: row.txns_24h,
      buys24h: row.buys_24h,
      sells24h: row.sells_24h,
      updatedAt: row.updated_at,
    },
  }));
}

function mapRiskScoreFromDb(data: Record<string, unknown>): RiskScore {
  return {
    tokenAddress: data.token_address as string,
    chainId: data.chain_id as ChainId,
    totalScore: data.total_score as number,
    level: data.risk_level as RiskLevel,
    liquidity: {
      score: data.liquidity_score as number,
      liquidity: parseFloat(data.liquidity_usd as string) || 0,
      lpLocked: data.lp_locked as boolean,
      lpLockedPercent: parseFloat(data.lp_locked_percent as string) || 0,
      lpBurnedPercent: 0,
      warnings: [],
    },
    holders: {
      score: data.holder_score as number,
      totalHolders: data.total_holders as number,
      top10Percent: parseFloat(data.top_10_percent as string) || 0,
      top20Percent: 0,
      creatorHoldingPercent: parseFloat(data.creator_percent as string) || 0,
      warnings: [],
    },
    contract: {
      score: data.contract_score as number,
      verified: data.is_verified as boolean,
      renounced: data.is_renounced as boolean,
      hasProxy: false,
      hasMintFunction: data.has_mint as boolean,
      hasPauseFunction: data.has_pause as boolean,
      hasBlacklistFunction: data.has_blacklist as boolean,
      maxTaxPercent: parseFloat(data.max_tax_percent as string) || 0,
      warnings: [],
    },
    honeypot: {
      score: data.honeypot_score as number,
      isHoneypot: data.is_honeypot as boolean,
      buyTax: parseFloat(data.buy_tax as string) || 0,
      sellTax: parseFloat(data.sell_tax as string) || 0,
      transferTax: 0,
      cannotSell: data.cannot_sell as boolean,
      cannotTransfer: false,
      warnings: [],
    },
    warnings: (data.warnings as unknown[]) || [],
    analyzedAt: data.analyzed_at as string,
  } as RiskScore;
}
