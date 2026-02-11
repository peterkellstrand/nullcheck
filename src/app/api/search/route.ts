import { NextRequest, NextResponse } from 'next/server';
import { ChainId } from '@/types/chain';
import { TokenSearchResult } from '@/types/token';

const BASE_URL = 'https://api.dexscreener.com/latest';

export const runtime = 'edge';

interface DexScreenerSearchResult {
  chainId: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  volume: { h24: number };
  liquidity: { usd: number };
  info?: { imageUrl?: string };
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json({
      success: false,
      error: 'Query must be at least 2 characters',
      results: [],
    });
  }

  try {
    const response = await fetch(
      `${BASE_URL}/dex/search?q=${encodeURIComponent(query)}`,
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 30 },
      }
    );

    if (!response.ok) {
      throw new Error('DexScreener API error');
    }

    const data = await response.json();
    const pairs: DexScreenerSearchResult[] = data.pairs || [];

    // Dedupe by token address and map to search results
    const seen = new Set<string>();
    const results: TokenSearchResult[] = [];

    for (const pair of pairs) {
      const chainId = mapChainId(pair.chainId);
      if (!chainId) continue;

      const key = `${chainId}-${pair.baseToken.address.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        address: pair.baseToken.address,
        chainId,
        symbol: pair.baseToken.symbol,
        name: pair.baseToken.name,
        logoUrl: pair.info?.imageUrl,
        liquidity: pair.liquidity?.usd,
        volume24h: pair.volume?.h24,
      });

      if (results.length >= 20) break;
    }

    return NextResponse.json({
      success: true,
      results,
      meta: {
        query,
        count: results.length,
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Search failed',
        results: [],
      },
      { status: 500 }
    );
  }
}

function mapChainId(chain: string): ChainId | null {
  const map: Record<string, ChainId> = {
    ethereum: 'ethereum',
    base: 'base',
    solana: 'solana',
  };
  return map[chain] || null;
}
