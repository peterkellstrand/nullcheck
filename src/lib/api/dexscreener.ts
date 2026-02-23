import { ChainId } from '@/types/chain';
import { Token, Pool, TokenMetrics } from '@/types/token';
import { checkRateLimit } from './rate-limiter';

const BASE_URL = 'https://api.dexscreener.com/latest';
const TOKEN_PROFILES_URL = 'https://api.dexscreener.com/token-profiles/latest/v1';

const CHAIN_MAP: Record<ChainId, string> = {
  ethereum: 'ethereum',
  base: 'base',
  solana: 'solana',
};

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  marketCap?: number;
  pairCreatedAt: number;
  info?: {
    imageUrl?: string;
    websites?: { label: string; url: string }[];
    socials?: { type: string; url: string }[];
  };
}

interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[] | null;
}

async function fetchApi<T>(endpoint: string): Promise<T> {
  await checkRateLimit('dexscreener');

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Accept: 'application/json',
    },
    next: { revalidate: 10 },
  });

  if (!response.ok) {
    throw new Error(`DexScreener API error: ${response.status}`);
  }

  return response.json();
}

export async function getTokenPairs(
  chainId: ChainId,
  tokenAddress: string
): Promise<Pool[]> {
  const chain = CHAIN_MAP[chainId];
  const data = await fetchApi<DexScreenerResponse>(
    `/dex/tokens/${tokenAddress}`
  );

  if (!data.pairs) return [];

  return data.pairs
    .filter((pair) => pair.chainId === chain)
    .map((pair) => mapPair(pair, chainId));
}

export async function getPairByAddress(
  chainId: ChainId,
  pairAddress: string
): Promise<Pool | null> {
  const chain = CHAIN_MAP[chainId];
  const data = await fetchApi<DexScreenerResponse>(
    `/dex/pairs/${chain}/${pairAddress}`
  );

  if (!data.pairs || data.pairs.length === 0) return null;

  return mapPair(data.pairs[0], chainId);
}

export async function searchPairs(query: string): Promise<Pool[]> {
  const data = await fetchApi<DexScreenerResponse>(
    `/dex/search?q=${encodeURIComponent(query)}`
  );

  if (!data.pairs) return [];

  return data.pairs.map((pair) => {
    const chainId = mapChainId(pair.chainId);
    return mapPair(pair, chainId);
  });
}

export async function getTokenMetrics(
  chainId: ChainId,
  tokenAddress: string
): Promise<TokenMetrics | null> {
  const pairs = await getTokenPairs(chainId, tokenAddress);
  if (pairs.length === 0) return null;

  // Get the pair with highest liquidity
  const mainPair = pairs.reduce((a, b) =>
    (a.liquidity || 0) > (b.liquidity || 0) ? a : b
  );

  const data = await fetchApi<DexScreenerResponse>(
    `/dex/tokens/${tokenAddress}`
  );

  if (!data.pairs || data.pairs.length === 0) return null;

  const pairData = data.pairs[0];

  return {
    tokenAddress,
    chainId,
    price: parseFloat(pairData.priceUsd) || 0,
    priceChange1h: pairData.priceChange.h1 || 0,
    priceChange24h: pairData.priceChange.h24 || 0,
    priceChange7d: 0, // Not available from DexScreener
    volume24h: pairData.volume.h24 || 0,
    liquidity: pairData.liquidity?.usd || 0,
    marketCap: pairData.marketCap,
    fdv: pairData.fdv,
    txns24h: pairData.txns.h24.buys + pairData.txns.h24.sells,
    buys24h: pairData.txns.h24.buys,
    sells24h: pairData.txns.h24.sells,
    updatedAt: new Date().toISOString(),
  };
}

// Fetch token profiles with logos
interface TokenProfile {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  description?: string;
  links?: { type: string; label: string; url: string }[];
}

export async function getLatestTokenProfiles(): Promise<TokenProfile[]> {
  try {
    const response = await fetch(TOKEN_PROFILES_URL, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

// Get trending pairs for a chain with full data
export async function getTrendingPairs(chainId: ChainId): Promise<DexScreenerPair[]> {
  const chain = CHAIN_MAP[chainId];

  // Search for popular/high volume pairs on the chain
  // Using broad search terms that typically return trending tokens
  // For Solana, include pump.fun meme tokens
  const searches = chainId === 'solana'
    ? ['SOL', 'BONK', 'WIF', 'JUP', 'PYTH', 'POPCAT', 'MEW', 'BOME', 'SLERF', 'PONKE', 'MYRO', 'WEN', 'SILLY', 'MOTHER', 'DADDY', 'GME', 'TRUMP', 'FWOG', 'GIGA', 'MICHI']
    : chainId === 'base'
    ? ['ETH', 'BRETT', 'DEGEN', 'TOSHI', 'AERO', 'WELL', 'USDbC', 'cbETH', 'MOCHI', 'BALD', 'NORMIE', 'DOGINME']
    : ['ETH', 'PEPE', 'SHIB', 'FLOKI', 'WOJAK', 'TURBO', 'BOB', 'MEME', 'BONE', 'LEASH', 'APU', 'NEIRO', 'MOG', 'ANDY', 'BITCOIN', 'DOGE', 'SPX', 'LADYS'];

  const allPairs: DexScreenerPair[] = [];

  // Fetch all searches in parallel for speed
  const searchPromises = searches.map(async (query) => {
    try {
      const data = await fetchApi<DexScreenerResponse>(`/dex/search?q=${query}`);
      if (data.pairs) {
        return data.pairs.filter(p => p.chainId === chain);
      }
    } catch {
      // Continue with other searches
    }
    return [];
  });

  const results = await Promise.all(searchPromises);
  results.forEach(pairs => allPairs.push(...pairs));

  // Dedupe by pair address and sort by volume
  const seen = new Set<string>();
  const uniquePairs = allPairs.filter(p => {
    if (seen.has(p.pairAddress)) return false;
    seen.add(p.pairAddress);
    return true;
  });

  return uniquePairs.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));
}

// Get latest token boosts (often includes pump.fun graduated tokens)
export async function getLatestBoostedTokens(): Promise<DexScreenerPair[]> {
  try {
    const response = await fetch('https://api.dexscreener.com/token-boosts/latest/v1', {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (!response.ok) return [];

    const boosts = await response.json();
    if (!Array.isArray(boosts)) return [];

    // Fetch pair data for boosted tokens
    const pairs: DexScreenerPair[] = [];
    const solanaBoosts = boosts
      .filter((b: { chainId: string }) => b.chainId === 'solana')
      .slice(0, 10);

    for (const boost of solanaBoosts) {
      try {
        const data = await fetchApi<DexScreenerResponse>(`/dex/tokens/${boost.tokenAddress}`);
        if (data.pairs && data.pairs.length > 0) {
          // Get the highest liquidity pair
          const bestPair = data.pairs
            .filter(p => p.chainId === 'solana')
            .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
          if (bestPair) pairs.push(bestPair);
        }
      } catch {
        // Continue with other tokens
      }
    }

    return pairs;
  } catch {
    return [];
  }
}

// Export the pair type for use in routes
export type { DexScreenerPair };

function mapChainId(chain: string): ChainId {
  const reverseMap: Record<string, ChainId> = {
    ethereum: 'ethereum',
    base: 'base',
    solana: 'solana',
  };
  return reverseMap[chain] || 'ethereum';
}

function mapPair(pair: DexScreenerPair, chainId: ChainId): Pool {
  return {
    address: pair.pairAddress,
    chainId,
    dex: pair.dexId,
    baseToken: {
      address: pair.baseToken.address,
      chainId,
      symbol: pair.baseToken.symbol,
      name: pair.baseToken.name,
      decimals: 18, // DexScreener doesn't provide decimals
      logoUrl: pair.info?.imageUrl,
    },
    quoteToken: {
      address: pair.quoteToken.address,
      chainId,
      symbol: pair.quoteToken.symbol,
      name: pair.quoteToken.name,
      decimals: 18,
    },
    liquidity: pair.liquidity?.usd || 0,
    volume24h: pair.volume.h24 || 0,
    createdAt: new Date(pair.pairCreatedAt).toISOString(),
  };
}
