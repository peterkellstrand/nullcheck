import {
  DexPaprikaToken,
  DexPaprikaPool,
  DexPaprikaOHLCV,
  DexPaprikaResponse,
} from '@/types/api';
import { ChainId } from '@/types/chain';
import { Token, TokenMetrics, Pool, OHLCV } from '@/types/token';

const BASE_URL = 'https://api.dexpaprika.com/v1';

const CHAIN_MAP: Record<ChainId, string> = {
  ethereum: 'ethereum',
  base: 'base',
  solana: 'solana',
  arbitrum: 'arbitrum',
};

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Accept: 'application/json',
    },
    next: { revalidate: 30 },
  });

  if (!response.ok) {
    throw new Error(`DexPaprika API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function getTopPools(
  chainId: ChainId,
  limit: number = 100
): Promise<Pool[]> {
  const chain = CHAIN_MAP[chainId];
  const data = await fetchApi<DexPaprikaResponse<DexPaprikaPool[]>>(
    `/networks/${chain}/pools?limit=${limit}&sort=volume_24h_usd&order=desc`
  );

  return data.data.map((pool) => mapPool(pool, chainId));
}

export async function getPool(
  chainId: ChainId,
  poolAddress: string
): Promise<Pool | null> {
  try {
    const chain = CHAIN_MAP[chainId];
    const data = await fetchApi<DexPaprikaPool>(
      `/networks/${chain}/pools/${poolAddress}`
    );
    return mapPool(data, chainId);
  } catch {
    return null;
  }
}

export async function getToken(
  chainId: ChainId,
  tokenAddress: string
): Promise<Token | null> {
  try {
    const chain = CHAIN_MAP[chainId];
    const data = await fetchApi<DexPaprikaToken>(
      `/networks/${chain}/tokens/${tokenAddress}`
    );
    return mapToken(data, chainId);
  } catch {
    return null;
  }
}

export async function getTokenPools(
  chainId: ChainId,
  tokenAddress: string,
  limit: number = 10
): Promise<Pool[]> {
  const chain = CHAIN_MAP[chainId];
  const data = await fetchApi<DexPaprikaResponse<DexPaprikaPool[]>>(
    `/networks/${chain}/tokens/${tokenAddress}/pools?limit=${limit}`
  );

  return data.data.map((pool) => mapPool(pool, chainId));
}

export async function getPoolOHLCV(
  chainId: ChainId,
  poolAddress: string,
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
  limit: number = 100
): Promise<OHLCV[]> {
  const chain = CHAIN_MAP[chainId];
  const data = await fetchApi<DexPaprikaResponse<DexPaprikaOHLCV[]>>(
    `/networks/${chain}/pools/${poolAddress}/ohlcv?interval=${interval}&limit=${limit}`
  );

  return data.data.map((candle) => ({
    timestamp: new Date(candle.timestamp).getTime(),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  }));
}

export async function searchTokens(
  query: string,
  chainId?: ChainId,
  limit: number = 20
): Promise<Token[]> {
  let endpoint = `/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  if (chainId) {
    endpoint += `&network=${CHAIN_MAP[chainId]}`;
  }

  const data = await fetchApi<DexPaprikaResponse<{ tokens: DexPaprikaToken[] }>>(endpoint);

  return data.data.tokens.map((token) => ({
    address: token.address,
    chainId: (token.chain as ChainId) || chainId || 'ethereum',
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    logoUrl: token.logo_url,
    totalSupply: token.total_supply,
    createdAt: token.created_at,
  }));
}

export function createPriceStream(
  chainId: ChainId,
  poolAddresses: string[],
  onMessage: (data: { poolAddress: string; price: number; volume24h: number }) => void,
  onError?: (error: Error) => void
): () => void {
  const chain = CHAIN_MAP[chainId];
  const pools = poolAddresses.join(',');
  const url = `${BASE_URL}/networks/${chain}/pools/sse?pools=${pools}`;

  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage({
        poolAddress: data.pool_address,
        price: data.price,
        volume24h: data.volume_24h_usd,
      });
    } catch (error) {
      console.error('SSE parse error:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    onError?.(new Error('SSE connection failed'));
  };

  return () => {
    eventSource.close();
  };
}

// Mapper functions
function mapToken(data: DexPaprikaToken, chainId: ChainId): Token {
  return {
    address: data.address,
    chainId,
    symbol: data.symbol,
    name: data.name,
    decimals: data.decimals,
    logoUrl: data.logo_url,
    totalSupply: data.total_supply,
    createdAt: data.created_at,
  };
}

function mapPool(data: DexPaprikaPool, chainId: ChainId): Pool {
  return {
    address: data.address,
    chainId,
    dex: data.dex,
    baseToken: mapToken(data.base_token, chainId),
    quoteToken: mapToken(data.quote_token, chainId),
    liquidity: data.liquidity_usd,
    volume24h: data.volume_24h_usd,
    createdAt: data.created_at,
  };
}

export async function getTokenMetrics(
  chainId: ChainId,
  tokenAddress: string
): Promise<TokenMetrics | null> {
  try {
    const pools = await getTokenPools(chainId, tokenAddress, 1);
    if (pools.length === 0) return null;

    const mainPool = pools[0];

    // In a real implementation, we'd fetch more detailed metrics
    return {
      tokenAddress,
      chainId,
      price: 0, // Would be calculated from pool data
      priceChange1h: 0,
      priceChange24h: 0,
      priceChange7d: 0,
      volume24h: mainPool.volume24h,
      liquidity: mainPool.liquidity,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
