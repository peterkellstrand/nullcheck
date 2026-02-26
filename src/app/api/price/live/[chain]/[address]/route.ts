/**
 * Live price endpoint for individual tokens
 * Returns the latest cached WebSocket price if available
 * Falls back to API fetch if not
 */

import { NextRequest, NextResponse } from 'next/server';
import { ChainId } from '@/types/chain';
import { getCachedPrice, isStreamsReady } from '@/lib/websocket/setup';
import * as dexscreener from '@/lib/api/dexscreener';

interface RouteContext {
  params: Promise<{
    chain: string;
    address: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const params = await context.params;
  const chainId = params.chain as ChainId;
  const address = params.address;

  // Validate chain
  if (!['ethereum', 'base', 'solana'].includes(chainId)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_CHAIN', message: 'Unsupported chain' } },
      { status: 400 }
    );
  }

  try {
    // Check for cached WebSocket price first
    if (isStreamsReady()) {
      const wsPrice = getCachedPrice(chainId, address);
      if (wsPrice !== undefined && wsPrice > 0) {
        return NextResponse.json({
          success: true,
          data: {
            price: wsPrice,
            source: 'websocket',
            timestamp: Date.now(),
          },
        });
      }
    }

    // Fall back to DexScreener API
    const pair = await dexscreener.getPairByTokenAddress(chainId, address);

    if (pair) {
      return NextResponse.json({
        success: true,
        data: {
          price: parseFloat(pair.priceUsd) || 0,
          priceChange1h: pair.priceChange?.h1 || 0,
          priceChange24h: pair.priceChange?.h24 || 0,
          volume24h: pair.volume?.h24 || 0,
          source: 'api',
          timestamp: Date.now(),
        },
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Token not found' } },
      { status: 404 }
    );
  } catch (error) {
    console.error('Live price error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch price' } },
      { status: 500 }
    );
  }
}
