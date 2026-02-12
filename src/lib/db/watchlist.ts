import { ChainId } from '@/types/chain';
import { TokenWithMetrics } from '@/types/token';

// Get all watched token keys for a user
export async function getWatchedTokenKeys(
  supabase: ReturnType<typeof import('@supabase/ssr').createServerClient>,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_watchlists')
    .select('token_address, chain_id')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching watchlist:', error);
    return [];
  }

  return data.map(
    (item: { token_address: string; chain_id: string }) =>
      `${item.chain_id}-${item.token_address.toLowerCase()}`
  );
}

// Get watchlist with full token data
export async function getWatchlistWithTokens(
  supabase: ReturnType<typeof import('@supabase/ssr').createServerClient>,
  userId: string
): Promise<TokenWithMetrics[]> {
  const { data, error } = await supabase
    .from('user_watchlists')
    .select(`
      token_address,
      chain_id,
      created_at,
      tokens!inner (
        address,
        chain_id,
        symbol,
        name,
        decimals,
        logo_url,
        total_supply
      ),
      token_metrics (
        price,
        price_change_1h,
        price_change_24h,
        price_change_7d,
        volume_24h,
        liquidity,
        market_cap,
        fdv,
        holders,
        txns_24h,
        buys_24h,
        sells_24h
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching watchlist with tokens:', error);
    return [];
  }

  return data.map((item: Record<string, unknown>) => {
    const token = item.tokens as Record<string, unknown>;
    const metrics = (item.token_metrics as Record<string, unknown>[]) || [];
    const latestMetrics = metrics[0] || {};

    return {
      address: token.address as string,
      chainId: token.chain_id as ChainId,
      symbol: token.symbol as string,
      name: token.name as string,
      decimals: token.decimals as number,
      logoUrl: token.logo_url as string | undefined,
      totalSupply: token.total_supply as string | undefined,
      metrics: {
        price: (latestMetrics.price as number) || 0,
        priceChange1h: (latestMetrics.price_change_1h as number) || 0,
        priceChange24h: (latestMetrics.price_change_24h as number) || 0,
        priceChange7d: (latestMetrics.price_change_7d as number) || 0,
        volume24h: (latestMetrics.volume_24h as number) || 0,
        liquidity: (latestMetrics.liquidity as number) || 0,
        marketCap: latestMetrics.market_cap as number | undefined,
        fdv: latestMetrics.fdv as number | undefined,
        holders: latestMetrics.holders as number | undefined,
        txns24h: latestMetrics.txns_24h as number | undefined,
        buys24h: latestMetrics.buys_24h as number | undefined,
        sells24h: latestMetrics.sells_24h as number | undefined,
      },
    };
  });
}

// Add token to watchlist
export async function addToWatchlist(
  supabase: ReturnType<typeof import('@supabase/ssr').createServerClient>,
  userId: string,
  chainId: ChainId,
  address: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('user_watchlists').insert({
    user_id: userId,
    chain_id: chainId,
    token_address: address.toLowerCase(),
  });

  if (error) {
    // Ignore duplicate errors
    if (error.code === '23505') {
      return { success: true };
    }
    console.error('Error adding to watchlist:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// Remove token from watchlist
export async function removeFromWatchlist(
  supabase: ReturnType<typeof import('@supabase/ssr').createServerClient>,
  userId: string,
  chainId: ChainId,
  address: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('user_watchlists')
    .delete()
    .eq('user_id', userId)
    .eq('chain_id', chainId)
    .eq('token_address', address.toLowerCase());

  if (error) {
    console.error('Error removing from watchlist:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
