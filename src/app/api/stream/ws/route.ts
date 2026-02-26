/**
 * WebSocket-enhanced SSE stream
 * Uses real-time WebSocket data when available, falls back to API polling
 */

import { NextRequest } from 'next/server';
import { ChainId } from '@/types/chain';
import * as dexscreener from '@/lib/api/dexscreener';

export const runtime = 'edge';

// Faster update interval for WebSocket-enhanced stream
const UPDATE_INTERVAL = 2000;

// In-memory price cache (shared across requests in same worker)
const priceCache = new Map<string, {
  price: number;
  priceChange1h: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  timestamp: number;
  source: 'ws' | 'api';
}>();

/**
 * Update price cache from WebSocket (called by WebSocket handlers)
 */
export function updatePriceFromWebSocket(
  chainId: ChainId,
  tokenAddress: string,
  price: number
): void {
  const key = `${chainId}-${tokenAddress.toLowerCase()}`;
  const existing = priceCache.get(key);

  // Keep API data for change percentages, just update price
  if (existing) {
    priceCache.set(key, {
      ...existing,
      price,
      timestamp: Date.now(),
      source: 'ws',
    });
  } else {
    priceCache.set(key, {
      price,
      priceChange1h: 0,
      priceChange24h: 0,
      volume24h: 0,
      liquidity: 0,
      timestamp: Date.now(),
      source: 'ws',
    });
  }
}

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isActive = true;

      const safeEnqueue = (data: string) => {
        if (!isActive) return false;
        try {
          controller.enqueue(encoder.encode(data));
          return true;
        } catch {
          isActive = false;
          return false;
        }
      };

      // Send initial connection message
      safeEnqueue(`data: ${JSON.stringify({
        type: 'connected',
        mode: 'websocket-enhanced',
        timestamp: Date.now()
      })}\n\n`);

      // Fetch initial API data to populate cache
      const fetchApiData = async () => {
        if (!isActive) return;

        try {
          const chains: ChainId[] = ['ethereum', 'base', 'solana'];
          const results = await Promise.all(
            chains.map(async (chainId) => {
              try {
                const pairs = await dexscreener.getTrendingPairs(chainId);
                return pairs.slice(0, 20).map(pair => ({
                  key: `${chainId}-${pair.baseToken.address.toLowerCase()}`,
                  data: {
                    price: parseFloat(pair.priceUsd) || 0,
                    priceChange1h: pair.priceChange?.h1 || 0,
                    priceChange24h: pair.priceChange?.h24 || 0,
                    volume24h: pair.volume?.h24 || 0,
                    liquidity: pair.liquidity?.usd || 0,
                    timestamp: Date.now(),
                    source: 'api' as const,
                  }
                }));
              } catch {
                return [];
              }
            })
          );

          // Update cache with API data (only if no fresher WS data)
          results.flat().forEach(({ key, data }) => {
            const existing = priceCache.get(key);
            if (!existing || existing.source !== 'ws' || Date.now() - existing.timestamp > 30000) {
              priceCache.set(key, data);
            }
          });
        } catch (error) {
          console.error('API fetch error:', error);
        }
      };

      const sendPriceUpdates = async () => {
        if (!isActive) return;

        // Convert cache to updates object
        const updates: Record<string, {
          price: number;
          priceChange1h: number;
          priceChange24h: number;
          volume24h: number;
          liquidity: number;
        }> = {};

        priceCache.forEach((data, key) => {
          // Only include relatively fresh data (last 60 seconds)
          if (Date.now() - data.timestamp < 60000) {
            updates[key] = {
              price: data.price,
              priceChange1h: data.priceChange1h,
              priceChange24h: data.priceChange24h,
              volume24h: data.volume24h,
              liquidity: data.liquidity,
            };
          }
        });

        if (Object.keys(updates).length > 0 && isActive) {
          safeEnqueue(`data: ${JSON.stringify({
            type: 'prices',
            updates,
            timestamp: Date.now()
          })}\n\n`);
        }
      };

      // Initial API fetch
      await fetchApiData();
      await sendPriceUpdates();

      // Set up intervals
      const apiIntervalId = setInterval(fetchApiData, 30000); // API every 30s
      const updateIntervalId = setInterval(sendPriceUpdates, UPDATE_INTERVAL);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        isActive = false;
        clearInterval(apiIntervalId);
        clearInterval(updateIntervalId);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
