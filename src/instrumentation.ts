/**
 * Next.js Instrumentation
 * Runs once when the server starts
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server, not during build
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Server starting...');

    // Initialize WebSocket price streams if API keys are available
    const hasAlchemy = !!process.env.ALCHEMY_API_KEY;
    const hasHelius = !!process.env.HELIUS_API_KEY;

    if (hasAlchemy || hasHelius) {
      try {
        // Dynamic import to avoid bundling issues
        const { setupPriceStreams } = await import('@/lib/websocket/setup');
        await setupPriceStreams();
        console.log('[Instrumentation] WebSocket price streams initialized');
      } catch (error) {
        console.error('[Instrumentation] Failed to setup price streams:', error);
      }
    } else {
      console.log('[Instrumentation] No WebSocket API keys configured, using API polling only');
    }

    console.log('[Instrumentation] Server ready');
  }
}
