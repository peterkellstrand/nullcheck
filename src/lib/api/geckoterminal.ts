import {
  GeckoTerminalPool,
  GeckoTerminalToken,
  GeckoTerminalOHLCV,
} from '@/types/api';
import { ChainId } from '@/types/chain';
import { Pool, OHLCV, TokenWithMetrics } from '@/types/token';

const BASE_URL = 'https://api.geckoterminal.com/api/v2';

const NETWORK_MAP: Record<ChainId, string> = {
  ethereum: 'eth',
  base: 'base',
  solana: 'solana',
};

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Accept: 'application/json',
    },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`GeckoTerminal API error: ${response.status}`);
  }

  return response.json();
}

interface GeckoResponse<T> {
  data: T;
  included?: GeckoTerminalToken[];
}

export async function getTrendingPools(
  chainId: ChainId,
  limit: number = 20
): Promise<Pool[]> {
  const network = NETWORK_MAP[chainId];
  const response = await fetchApi<GeckoResponse<GeckoTerminalPool[]>>(
    `/networks/${network}/trending_pools?page=1`
  );

  const tokens = new Map<string, GeckoTerminalToken>();
  response.included?.forEach((token) => {
    tokens.set(token.id, token);
  });

  return response.data.slice(0, limit).map((pool) => mapPool(pool, chainId, tokens));
}

export async function getNewPools(
  chainId: ChainId,
  limit: number = 20
): Promise<Pool[]> {
  const network = NETWORK_MAP[chainId];
  const response = await fetchApi<GeckoResponse<GeckoTerminalPool[]>>(
    `/networks/${network}/new_pools?page=1`
  );

  const tokens = new Map<string, GeckoTerminalToken>();
  response.included?.forEach((token) => {
    tokens.set(token.id, token);
  });

  return response.data.slice(0, limit).map((pool) => mapPool(pool, chainId, tokens));
}

export async function getPoolOHLCV(
  chainId: ChainId,
  poolAddress: string,
  timeframe: 'minute' | 'hour' | 'day' = 'hour',
  aggregate: number = 1,
  limit: number = 100
): Promise<OHLCV[]> {
  const network = NETWORK_MAP[chainId];
  const response = await fetchApi<{ data: { attributes: GeckoTerminalOHLCV } }>(
    `/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}`
  );

  return response.data.attributes.ohlcv_list.map(
    ([timestamp, open, high, low, close, volume]) => ({
      timestamp: timestamp * 1000,
      open,
      high,
      low,
      close,
      volume,
    })
  );
}

export async function getTopGainerPools(chainId: ChainId): Promise<Pool[]> {
  const network = NETWORK_MAP[chainId];
  const response = await fetchApi<GeckoResponse<GeckoTerminalPool[]>>(
    `/networks/${network}/pools?page=1&sort=h24_price_change_percent_desc`
  );

  const tokens = new Map<string, GeckoTerminalToken>();
  response.included?.forEach((token) => {
    tokens.set(token.id, token);
  });

  return response.data.map((pool) => mapPool(pool, chainId, tokens));
}

export async function getPool(
  chainId: ChainId,
  poolAddress: string
): Promise<Pool | null> {
  try {
    const network = NETWORK_MAP[chainId];
    const response = await fetchApi<GeckoResponse<GeckoTerminalPool>>(
      `/networks/${network}/pools/${poolAddress}?include=base_token,quote_token`
    );

    const tokens = new Map<string, GeckoTerminalToken>();
    response.included?.forEach((token) => {
      tokens.set(token.id, token);
    });

    return mapPool(response.data, chainId, tokens);
  } catch {
    return null;
  }
}

export async function searchPools(
  query: string,
  chainId?: ChainId
): Promise<Pool[]> {
  let endpoint = `/search/pools?query=${encodeURIComponent(query)}`;
  if (chainId) {
    endpoint += `&network=${NETWORK_MAP[chainId]}`;
  }

  const response = await fetchApi<GeckoResponse<GeckoTerminalPool[]>>(endpoint);

  const tokens = new Map<string, GeckoTerminalToken>();
  response.included?.forEach((token) => {
    tokens.set(token.id, token);
  });

  return response.data.map((pool) =>
    mapPool(pool, chainId || 'ethereum', tokens)
  );
}

function mapPool(
  data: GeckoTerminalPool,
  chainId: ChainId,
  tokens: Map<string, GeckoTerminalToken>
): Pool {
  const baseTokenData = tokens.get(data.relationships.base_token.data.id);
  const quoteTokenData = tokens.get(data.relationships.quote_token.data.id);

  return {
    address: data.attributes.address,
    chainId,
    dex: data.id.split('_')[1] || 'unknown',
    baseToken: {
      address: baseTokenData?.attributes.address || '',
      chainId,
      symbol: baseTokenData?.attributes.symbol || '',
      name: baseTokenData?.attributes.name || '',
      decimals: baseTokenData?.attributes.decimals || 18,
      logoUrl: baseTokenData?.attributes.image_url,
    },
    quoteToken: {
      address: quoteTokenData?.attributes.address || '',
      chainId,
      symbol: quoteTokenData?.attributes.symbol || '',
      name: quoteTokenData?.attributes.name || '',
      decimals: quoteTokenData?.attributes.decimals || 18,
      logoUrl: quoteTokenData?.attributes.image_url,
    },
    liquidity: parseFloat(data.attributes.reserve_in_usd) || 0,
    volume24h: parseFloat(data.attributes.volume_usd.h24) || 0,
    createdAt: data.attributes.pool_created_at,
  };
}
