import { NextRequest } from 'next/server';
import { ChainId } from '@/types/chain';
import * as dexscreener from '@/lib/api/dexscreener';

export const runtime = 'edge';

// Price update interval (5 seconds)
const UPDATE_INTERVAL = 5000;

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`)
      );

      const sendPriceUpdates = async () => {
        try {
          const chains: ChainId[] = ['ethereum', 'base', 'solana'];
          const updates: Record<string, {
            price: number;
            priceChange1h: number;
            priceChange24h: number;
            volume24h: number;
            liquidity: number;
          }> = {};

          // Fetch latest data from all chains in parallel
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
                  }
                }));
              } catch {
                return [];
              }
            })
          );

          // Flatten and build updates object
          results.flat().forEach(({ key, data }) => {
            updates[key] = data;
          });

          // Send price update event
          if (Object.keys(updates).length > 0) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'prices',
                updates,
                timestamp: Date.now()
              })}\n\n`)
            );
          }
        } catch (error) {
          console.error('SSE price update error:', error);
          // Send error event but keep connection alive
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Failed to fetch prices' })}\n\n`)
          );
        }
      };

      // Send initial prices immediately
      await sendPriceUpdates();

      // Set up interval for continuous updates
      const intervalId = setInterval(sendPriceUpdates, UPDATE_INTERVAL);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        controller.close();
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
