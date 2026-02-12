import { NextRequest, NextResponse } from 'next/server';
import { ChainId, CHAINS } from '@/types/chain';
import { TokenWithMetrics } from '@/types/token';
import { getRiskLevel } from '@/types/risk';
import * as dexscreener from '@/lib/api/dexscreener';
import * as db from '@/lib/db/supabase';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chain: string; address: string }> }
) {
  const { chain, address } = await params;
  const chainId = chain as ChainId;

  // Validate chain
  if (!CHAINS[chainId]) {
    return NextResponse.json(
      { success: false, error: 'Invalid chain' },
      { status: 400 }
    );
  }

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

      return NextResponse.json({
        success: true,
        token,
        fromCache: true,
      });
    }

    // Fetch from DexScreener
    const pairs = await dexscreener.getTokenPairs(chainId, address);

    if (pairs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Token not found' },
        { status: 404 }
      );
    }

    // Get the pair with highest liquidity
    const mainPair = pairs.reduce((a, b) =>
      (a.liquidity || 0) > (b.liquidity || 0) ? a : b
    );

    // Fetch full token data
    const metrics = await dexscreener.getTokenMetrics(chainId, address);

    if (!metrics) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch token metrics' },
        { status: 500 }
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

    return NextResponse.json({
      success: true,
      token,
      fromCache: false,
    });
  } catch (error) {
    console.error('Token fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch token' },
      { status: 500 }
    );
  }
}
