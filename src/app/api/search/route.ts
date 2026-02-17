import { NextRequest, NextResponse } from 'next/server';
import { ChainId } from '@/types/chain';
import { TokenSearchResult } from '@/types/token';
import {
  generateRequestId,
  generateETag,
  getCorsHeaders,
  createErrorResponse,
  handleCorsOptions,
  API_VERSION,
} from '@/lib/api/utils';

const BASE_URL = 'https://api.dexscreener.com/latest';

export const runtime = 'edge';

export const OPTIONS = handleCorsOptions;

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
  const requestId = request.headers.get('X-Request-ID') || generateRequestId();
  const query = request.nextUrl.searchParams.get('q');

  if (!query || query.length < 2) {
    return createErrorResponse(
      'VALIDATION_ERROR',
      'Query must be at least 2 characters',
      400,
      requestId,
      { minLength: 2 }
    );
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

    const etag = generateETag({ query, results: results.map(r => r.address) });

    // Check If-None-Match for conditional GET
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ...getCorsHeaders(),
          'X-Request-ID': requestId,
          'X-API-Version': API_VERSION,
          ETag: etag,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          results,
          meta: {
            query,
            count: results.length,
          },
        },
      },
      {
        headers: {
          ...getCorsHeaders(),
          'X-Request-ID': requestId,
          'X-API-Version': API_VERSION,
          'Cache-Control': 'public, max-age=30',
          ETag: etag,
        },
      }
    );
  } catch (error) {
    console.error('Search error:', error);
    return createErrorResponse(
      'INTERNAL_ERROR',
      'Search failed',
      500,
      requestId
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
