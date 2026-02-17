import { NextRequest, NextResponse } from 'next/server';
import { ChainId, CHAINS } from '@/types/chain';
import { TokenWithMetrics } from '@/types/token';
import * as dexscreener from '@/lib/api/dexscreener';
import * as db from '@/lib/db/supabase';
import {
  generateRequestId,
  generateETag,
  getCorsHeaders,
  createErrorResponse,
  validateAddress,
  handleCorsOptions,
  API_VERSION,
} from '@/lib/api/utils';

export const runtime = 'edge';

export const OPTIONS = handleCorsOptions;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chain: string; address: string }> }
) {
  const requestId = request.headers.get('X-Request-ID') || generateRequestId();
  const { chain, address } = await params;
  const chainId = chain as ChainId;

  // Validate chain
  if (!CHAINS[chainId]) {
    return createErrorResponse(
      'INVALID_CHAIN',
      `Chain '${chain}' is not supported. Valid chains: ${Object.keys(CHAINS).join(', ')}`,
      400,
      requestId
    );
  }

  // Validate address format
  if (!validateAddress(chainId, address)) {
    return createErrorResponse(
      'INVALID_ADDRESS',
      `Invalid ${chainId} address format`,
      400,
      requestId
    );
  }

  const responseHeaders = {
    ...getCorsHeaders(),
    'X-Request-ID': requestId,
    'X-API-Version': API_VERSION,
  };

  try {
    // Try cache first
    const cachedToken = await db.getToken(chainId, address);
    const cachedMetrics = await db.getTokenMetrics(chainId, address);
    const cachedRisk = await db.getRiskScore(chainId, address);

    if (cachedToken && cachedMetrics) {
      const token: TokenWithMetrics = {
        ...cachedToken,
        metrics: cachedMetrics,
        risk: cachedRisk || undefined,
      };

      const etag = generateETag(token);

      // Check If-None-Match for conditional GET
      const ifNoneMatch = request.headers.get('If-None-Match');
      if (ifNoneMatch === etag) {
        return new NextResponse(null, {
          status: 304,
          headers: { ...responseHeaders, ETag: etag },
        });
      }

      return NextResponse.json(
        { success: true, data: { token }, cached: true },
        { headers: { ...responseHeaders, 'Cache-Control': 'public, max-age=30', ETag: etag } }
      );
    }

    // Fetch from DexScreener
    const pairs = await dexscreener.getTokenPairs(chainId, address);

    if (pairs.length === 0) {
      return createErrorResponse(
        'NOT_FOUND',
        'Token not found',
        404,
        requestId,
        { chain: chainId, address }
      );
    }

    // Get the pair with highest liquidity
    const mainPair = pairs.reduce((a, b) =>
      (a.liquidity || 0) > (b.liquidity || 0) ? a : b
    );

    // Fetch full token data
    const metrics = await dexscreener.getTokenMetrics(chainId, address);

    if (!metrics) {
      return createErrorResponse(
        'INTERNAL_ERROR',
        'Failed to fetch token metrics',
        500,
        requestId
      );
    }

    const token: TokenWithMetrics = {
      address: mainPair.baseToken.address,
      chainId,
      symbol: mainPair.baseToken.symbol,
      name: mainPair.baseToken.name,
      decimals: mainPair.baseToken.decimals,
      logoUrl: mainPair.baseToken.logoUrl,
      metrics,
      risk: cachedRisk || undefined,
    };

    // Cache the token (fire and forget)
    db.upsertToken({
      address: token.address,
      chainId: token.chainId,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      logoUrl: token.logoUrl,
    }).catch(console.error);

    db.upsertTokenMetrics(metrics).catch(console.error);

    const etag = generateETag(token);

    return NextResponse.json(
      { success: true, data: { token }, cached: false },
      { headers: { ...responseHeaders, ETag: etag } }
    );
  } catch (error) {
    console.error('Token fetch error:', error);
    return createErrorResponse(
      'INTERNAL_ERROR',
      'Failed to fetch token',
      500,
      requestId
    );
  }
}
