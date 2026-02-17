import { NextRequest, NextResponse } from 'next/server';
import { ChainId, CHAINS } from '@/types/chain';
import { OHLCV } from '@/types/token';
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

// Handle CORS preflight
export const OPTIONS = handleCorsOptions;

// Map our chain IDs to GeckoTerminal network IDs
const GECKO_NETWORK_MAP: Record<ChainId, string> = {
  ethereum: 'eth',
  base: 'base',
  solana: 'solana',
  arbitrum: 'arbitrum',
  polygon: 'polygon_pos',
};

// Map interval strings to GeckoTerminal timeframes
const INTERVAL_MAP: Record<string, string> = {
  '1m': 'minute',
  '5m': 'minute',
  '15m': 'minute',
  '1h': 'hour',
  '4h': 'hour',
  '1d': 'day',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chain: string; address: string }> }
) {
  const requestId = request.headers.get('X-Request-ID') || generateRequestId();
  const { chain, address } = await params;
  const chainId = chain as ChainId;

  const searchParams = request.nextUrl.searchParams;
  const interval = searchParams.get('interval') || '1h';
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

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
    'Cache-Control': 'public, max-age=30',
  };

  try {
    // First, get the pool address for this token from DexScreener
    const dexResponse = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'nullcheck/1.0',
        },
        next: { revalidate: 60 },
      }
    );

    if (!dexResponse.ok) {
      const placeholderOhlcv = generatePlaceholderOHLCV(0.001, limit, interval);
      return NextResponse.json(
        { success: true, data: { ohlcv: placeholderOhlcv }, fallback: true, reason: 'dexscreener_unavailable' },
        { headers: responseHeaders }
      );
    }

    const dexData = await dexResponse.json();
    const chainMap: Record<ChainId, string> = {
      ethereum: 'ethereum',
      base: 'base',
      solana: 'solana',
      arbitrum: 'arbitrum',
      polygon: 'polygon',
    };

    let pools = dexData.pairs?.filter(
      (p: { chainId: string }) => p.chainId === chainMap[chainId]
    ) || [];

    if (pools.length === 0 && dexData.pairs?.length > 0) {
      pools = dexData.pairs;
    }

    if (pools.length === 0) {
      const placeholderOhlcv = generatePlaceholderOHLCV(0.001, limit, interval);
      return NextResponse.json(
        { success: true, data: { ohlcv: placeholderOhlcv }, fallback: true, reason: 'no_pools' },
        { headers: responseHeaders }
      );
    }

    const mainPool = pools.reduce((a: { liquidity?: { usd: number } }, b: { liquidity?: { usd: number } }) =>
      (a.liquidity?.usd || 0) > (b.liquidity?.usd || 0) ? a : b
    );

    const network = GECKO_NETWORK_MAP[chainId];
    const timeframe = INTERVAL_MAP[interval] || 'hour';
    const aggregate = interval === '4h' ? 4 : interval === '15m' ? 15 : interval === '5m' ? 5 : 1;

    const geckoUrl = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${mainPool.pairAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}`;

    const geckoResponse = await fetch(geckoUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'nullcheck/1.0',
      },
      next: { revalidate: 30 },
    });

    if (!geckoResponse.ok) {
      const currentPrice = parseFloat(mainPool.priceUsd) || 0;
      const ohlcv = generatePlaceholderOHLCV(currentPrice, limit, interval);
      return NextResponse.json(
        { success: true, data: { ohlcv, pool: mainPool.pairAddress }, fallback: true },
        { headers: responseHeaders }
      );
    }

    const geckoData = await geckoResponse.json();
    const ohlcvList = geckoData.data?.attributes?.ohlcv_list || [];

    if (ohlcvList.length === 0) {
      const currentPrice = parseFloat(mainPool.priceUsd) || 0;
      const ohlcv = generatePlaceholderOHLCV(currentPrice, limit, interval);
      return NextResponse.json(
        { success: true, data: { ohlcv, pool: mainPool.pairAddress }, fallback: true },
        { headers: responseHeaders }
      );
    }

    // Transform GeckoTerminal format to our OHLCV format
    const ohlcv: OHLCV[] = ohlcvList.map((candle: number[]) => ({
      timestamp: candle[0] * 1000,
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5],
    })).reverse();

    const etag = generateETag(ohlcv);

    // Check If-None-Match for conditional GET
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ...responseHeaders, ETag: etag },
      });
    }

    return NextResponse.json(
      { success: true, data: { ohlcv, pool: mainPool.pairAddress } },
      { headers: { ...responseHeaders, ETag: etag } }
    );
  } catch (error) {
    console.error('OHLCV fetch error:', error);
    return createErrorResponse(
      'INTERNAL_ERROR',
      'Failed to fetch OHLCV data',
      500,
      requestId
    );
  }
}

// Generate placeholder OHLCV data when real data isn't available
function generatePlaceholderOHLCV(currentPrice: number, count: number, interval: string): OHLCV[] {
  const ohlcv: OHLCV[] = [];
  const now = Date.now();

  // Interval in milliseconds
  const intervalMs: Record<string, number> = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
  };

  const ms = intervalMs[interval] || intervalMs['1h'];
  let price = currentPrice * (1 + (Math.random() - 0.5) * 0.2); // Start with some variance

  for (let i = count - 1; i >= 0; i--) {
    const timestamp = now - i * ms;

    // Random walk
    const change = (Math.random() - 0.5) * 0.02 * price;
    const open = price;
    price = price + change;
    const close = price;

    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = Math.random() * 100000;

    ohlcv.push({ timestamp, open, high, low, close, volume });
  }

  return ohlcv;
}
