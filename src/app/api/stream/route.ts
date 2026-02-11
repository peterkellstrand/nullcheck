import { NextRequest } from 'next/server';
import { ChainId, CHAINS } from '@/types/chain';

export const runtime = 'edge';

// This is a simplified SSE implementation
// In production, you'd connect to the actual DexPaprika SSE stream
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chainId = searchParams.get('chain') as ChainId | null;
  const tokenAddresses = searchParams.get('tokens')?.split(',') || [];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const connectMessage = `data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`;
      controller.enqueue(encoder.encode(connectMessage));

      // Simulate price updates every 5 seconds
      // In production, this would forward events from DexPaprika SSE
      const interval = setInterval(() => {
        const update = {
          type: 'price_update',
          tokenAddress: tokenAddresses[0] || '0x0000000000000000000000000000000000000000',
          chainId: chainId || 'ethereum',
          price: Math.random() * 100,
          priceChange24h: (Math.random() - 0.5) * 20,
          volume24h: Math.random() * 1000000,
          timestamp: Date.now(),
        };

        const message = `data: ${JSON.stringify(update)}\n\n`;
        controller.enqueue(encoder.encode(message));
      }, 5000);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
