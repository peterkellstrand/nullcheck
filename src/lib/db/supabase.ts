import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ChainId } from '@/types/chain';
import { Token, TokenMetrics } from '@/types/token';
import { RiskScore, RiskLevel, RiskWarning } from '@/types/risk';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Singleton clients for connection pooling
const _anonClient: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        db: { schema: 'public' },
      })
    : null;

const _serverClient: SupabaseClient | null =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        db: { schema: 'public' },
      })
    : null;

// Query timeout (5 seconds)
const QUERY_TIMEOUT = 5000;

/**
 * Get the anon client (for public queries)
 */
export function getSupabase(): SupabaseClient | null {
  return _anonClient;
}

/**
 * Get the server client (for privileged operations)
 */
export function createServerClient(): SupabaseClient | null {
  return _serverClient;
}

/**
 * Normalize address based on chain (EVM = lowercase, Solana = as-is)
 */
function normalizeAddress(address: string, chainId: ChainId): string {
  return chainId === 'solana' ? address : address.toLowerCase();
}

/**
 * Wrap a query with timeout protection
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = QUERY_TIMEOUT
): Promise<T | null> {
  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), timeoutMs)
  );
  return Promise.race([promise, timeoutPromise]);
}

// =============================================================================
// TOKEN OPERATIONS
// =============================================================================

export async function getToken(
  chainId: ChainId,
  address: string
): Promise<Token | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const normalizedAddr = normalizeAddress(address, chainId);

  const result = await withTimeout(
    Promise.resolve(
      supabase
        .from('tokens')
        .select('*')
        .eq('chain_id', chainId)
        .eq('address', normalizedAddr)
        .single()
    )
  );

  if (!result) {
    console.warn(`Database timeout getting token ${chainId}:${address}`);
    return null;
  }

  const { data, error } = result;
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
      address: normalizeAddress(token.address, token.chainId),
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

// =============================================================================
// TOKEN METRICS OPERATIONS
// =============================================================================

export async function getTokenMetrics(
  chainId: ChainId,
  address: string
): Promise<TokenMetrics | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const normalizedAddr = normalizeAddress(address, chainId);

  const result = await withTimeout(
    Promise.resolve(
      supabase
        .from('token_metrics')
        .select('*')
        .eq('chain_id', chainId)
        .eq('token_address', normalizedAddr)
        .single()
    )
  );

  if (!result) {
    console.warn(`Database timeout getting metrics ${chainId}:${address}`);
    return null;
  }

  const { data, error } = result;
  if (error || !data) return null;

  return mapTokenMetricsFromDb(data);
}

export async function upsertTokenMetrics(metrics: TokenMetrics): Promise<void> {
  const db = createServerClient();
  if (!db) return;

  await db.from('token_metrics').upsert(
    {
      token_address: normalizeAddress(metrics.tokenAddress, metrics.chainId),
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

// =============================================================================
// RISK SCORE OPERATIONS
// =============================================================================

export async function getRiskScore(
  chainId: ChainId,
  address: string
): Promise<RiskScore | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const normalizedAddr = normalizeAddress(address, chainId);

  const result = await withTimeout(
    Promise.resolve(
      supabase
        .from('risk_scores')
        .select('*')
        .eq('chain_id', chainId)
        .eq('token_address', normalizedAddr)
        .gt('expires_at', new Date().toISOString())
        .single()
    )
  );

  if (!result) {
    console.warn(`Database timeout getting risk score ${chainId}:${address}`);
    return null;
  }

  const { data, error } = result;
  if (error || !data) return null;

  return mapRiskScoreFromDb(data);
}

/**
 * Batch get risk scores for multiple tokens
 * Much more efficient than individual queries
 */
export async function getRiskScoresBatch(
  requests: { chainId: ChainId; address: string }[]
): Promise<Map<string, RiskScore>> {
  const supabase = getSupabase();
  const results = new Map<string, RiskScore>();

  if (!supabase || requests.length === 0) return results;

  // Group by chain for efficient queries
  const byChain = new Map<ChainId, string[]>();
  requests.forEach((req) => {
    const normalized = normalizeAddress(req.address, req.chainId);
    const existing = byChain.get(req.chainId) || [];
    existing.push(normalized);
    byChain.set(req.chainId, existing);
  });

  // Fetch all chains in parallel
  const promises = Array.from(byChain.entries()).map(async ([chainId, addresses]) => {
    const result = await withTimeout(
      Promise.resolve(
        supabase
          .from('risk_scores')
          .select('*')
          .eq('chain_id', chainId)
          .in('token_address', addresses)
          .gt('expires_at', new Date().toISOString())
      ),
      QUERY_TIMEOUT * 2 // Allow more time for batch queries
    );

    if (result?.data) {
      result.data.forEach((row: Record<string, unknown>) => {
        const key = `${chainId}-${row.token_address}`;
        results.set(key, mapRiskScoreFromDb(row));
      });
    }
  });

  await Promise.all(promises);
  return results;
}

export async function upsertRiskScore(risk: RiskScore): Promise<void> {
  const db = createServerClient();
  if (!db) return;

  await db.from('risk_scores').upsert(
    mapRiskScoreToDb(risk),
    { onConflict: 'token_address,chain_id' }
  );
}

/**
 * Record risk score history (for historical tracking)
 * Uses database function with deduplication (only records if score changed or >1hr since last)
 */
export async function recordRiskHistory(risk: RiskScore): Promise<boolean> {
  const db = createServerClient();
  if (!db) return false;

  try {
    const { data, error } = await db.rpc('record_risk_history', {
      p_token_address: normalizeAddress(risk.tokenAddress, risk.chainId),
      p_chain_id: risk.chainId,
      p_total_score: risk.totalScore,
      p_risk_level: risk.level,
      p_honeypot_score: risk.honeypot.score,
      p_contract_score: risk.contract.score,
      p_holders_score: risk.holders.score,
      p_liquidity_score: risk.liquidity.score,
    });

    if (error) {
      console.error('Error recording risk history:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Failed to record risk history:', error);
    return false;
  }
}

/**
 * Get risk score history for a token
 */
export async function getRiskHistory(
  chainId: ChainId,
  address: string,
  days: number = 30
): Promise<RiskHistoryEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const normalizedAddr = normalizeAddress(address, chainId);
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('risk_score_history')
    .select('*')
    .eq('chain_id', chainId)
    .eq('token_address', normalizedAddr)
    .gte('recorded_at', cutoffDate)
    .order('recorded_at', { ascending: true });

  if (error || !data) {
    console.error('Error fetching risk history:', error);
    return [];
  }

  return data.map((row: Record<string, unknown>) => ({
    totalScore: row.total_score as number,
    riskLevel: row.risk_level as RiskLevel,
    honeypotScore: row.honeypot_score as number | null,
    contractScore: row.contract_score as number | null,
    holdersScore: row.holders_score as number | null,
    liquidityScore: row.liquidity_score as number | null,
    recordedAt: row.recorded_at as string,
  }));
}

export interface RiskHistoryEntry {
  totalScore: number;
  riskLevel: RiskLevel;
  honeypotScore: number | null;
  contractScore: number | null;
  holdersScore: number | null;
  liquidityScore: number | null;
  recordedAt: string;
}

/**
 * Batch upsert risk scores - single DB call for multiple tokens
 */
export async function upsertRiskScoreBatch(risks: RiskScore[]): Promise<void> {
  const db = createServerClient();
  if (!db || risks.length === 0) return;

  const records = risks.map(mapRiskScoreToDb);

  await db.from('risk_scores').upsert(records, {
    onConflict: 'token_address,chain_id',
    ignoreDuplicates: false,
  });
}

// =============================================================================
// TOP TOKENS QUERY
// =============================================================================

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

  const result = await withTimeout(Promise.resolve(query), QUERY_TIMEOUT * 2);

  if (!result) {
    console.warn('Database timeout getting top tokens');
    return [];
  }

  const { data, error } = result;
  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => {
    const tokens = row.tokens as Record<string, unknown>;
    return {
      address: tokens.address as string,
      chainId: row.chain_id as ChainId,
      symbol: tokens.symbol as string,
      name: tokens.name as string,
      decimals: tokens.decimals as number,
      logoUrl: tokens.logo_url as string | undefined,
      totalSupply: tokens.total_supply as string | undefined,
      createdAt: tokens.created_at as string | undefined,
      metrics: mapTokenMetricsFromDb(row),
    };
  });
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function mapTokenMetricsFromDb(data: Record<string, unknown>): TokenMetrics {
  return {
    tokenAddress: data.token_address as string,
    chainId: data.chain_id as ChainId,
    price: Number(data.price) || 0,
    priceChange1h: Number(data.price_change_1h) || 0,
    priceChange24h: Number(data.price_change_24h) || 0,
    priceChange7d: Number(data.price_change_7d) || 0,
    volume24h: Number(data.volume_24h) || 0,
    liquidity: Number(data.liquidity) || 0,
    marketCap: data.market_cap ? Number(data.market_cap) : undefined,
    fdv: data.fdv ? Number(data.fdv) : undefined,
    holders: data.holders as number | undefined,
    txns24h: data.txns_24h as number | undefined,
    buys24h: data.buys_24h as number | undefined,
    sells24h: data.sells_24h as number | undefined,
    updatedAt: data.updated_at as string,
  };
}

function mapRiskScoreFromDb(data: Record<string, unknown>): RiskScore {
  return {
    tokenAddress: data.token_address as string,
    chainId: data.chain_id as ChainId,
    totalScore: data.total_score as number,
    level: data.risk_level as RiskLevel,
    liquidity: {
      score: data.liquidity_score as number,
      liquidity: Number(data.liquidity_usd) || 0,
      lpLocked: data.lp_locked as boolean,
      lpLockedPercent: Number(data.lp_locked_percent) || 0,
      lpBurnedPercent: 0,
      warnings: [],
    },
    holders: {
      score: data.holder_score as number,
      totalHolders: data.total_holders as number,
      top10Percent: Number(data.top_10_percent) || 0,
      top20Percent: 0,
      creatorHoldingPercent: Number(data.creator_percent) || 0,
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
      maxTaxPercent: Number(data.max_tax_percent) || 0,
      warnings: [],
    },
    honeypot: {
      score: data.honeypot_score as number,
      isHoneypot: data.is_honeypot as boolean,
      buyTax: Number(data.buy_tax) || 0,
      sellTax: Number(data.sell_tax) || 0,
      transferTax: 0,
      cannotSell: data.cannot_sell as boolean,
      cannotTransfer: false,
      warnings: [],
    },
    warnings: (data.warnings as RiskWarning[]) || [],
    analyzedAt: data.analyzed_at as string,
  };
}

function mapRiskScoreToDb(risk: RiskScore): Record<string, unknown> {
  return {
    token_address: normalizeAddress(risk.tokenAddress, risk.chainId),
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
  };
}

// =============================================================================
// TRENDING TOKENS (MATERIALIZED VIEW)
// =============================================================================

export interface TrendingToken {
  address: string;
  chainId: ChainId;
  symbol: string;
  name: string;
  logoUrl?: string;
  decimals: number;
  price: number;
  priceChange1h: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap?: number;
  fdv?: number;
  txns24h?: number;
  buys24h?: number;
  sells24h?: number;
  riskScore?: number;
  riskLevel?: string;
  isHoneypot?: boolean;
}

/**
 * Get trending tokens from the materialized view (fast query)
 * Falls back to null if the view doesn't exist
 */
export async function getTrendingTokens(
  chainId?: ChainId,
  limit: number = 100
): Promise<TrendingToken[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    let query = supabase
      .from('trending_tokens_mv')
      .select('*')
      .order('volume_24h', { ascending: false })
      .limit(limit);

    if (chainId) {
      query = query.eq('chain_id', chainId);
    }

    const result = await withTimeout(Promise.resolve(query), QUERY_TIMEOUT);

    if (!result) {
      console.warn('Timeout querying trending tokens');
      return null;
    }

    const { data, error } = result;

    // If view doesn't exist, return null to trigger fallback
    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.log('Materialized view not available, using fallback');
        return null;
      }
      console.error('Error querying trending tokens:', error);
      return null;
    }

    if (!data || data.length === 0) return null;

    return data.map((row: Record<string, unknown>) => ({
      address: row.address as string,
      chainId: row.chain_id as ChainId,
      symbol: row.symbol as string,
      name: row.name as string,
      logoUrl: row.logo_url as string | undefined,
      decimals: row.decimals as number,
      price: Number(row.price) || 0,
      priceChange1h: Number(row.price_change_1h) || 0,
      priceChange24h: Number(row.price_change_24h) || 0,
      volume24h: Number(row.volume_24h) || 0,
      liquidity: Number(row.liquidity) || 0,
      marketCap: row.market_cap ? Number(row.market_cap) : undefined,
      fdv: row.fdv ? Number(row.fdv) : undefined,
      txns24h: row.txns_24h as number | undefined,
      buys24h: row.buys_24h as number | undefined,
      sells24h: row.sells_24h as number | undefined,
      riskScore: row.risk_score as number | undefined,
      riskLevel: row.risk_level as string | undefined,
      isHoneypot: row.is_honeypot as boolean | undefined,
    }));
  } catch (error) {
    console.error('Failed to query trending tokens:', error);
    return null;
  }
}
