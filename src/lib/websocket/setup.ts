/**
 * WebSocket Price Stream Setup
 * Initialize WebSocket connections on server startup
 *
 * In Next.js, this can be called from:
 * 1. instrumentation.ts (recommended for App Router)
 * 2. A standalone server process
 * 3. An API route that initializes on first call
 */

import { getPriceStreamManager, type PriceUpdate } from './index';

let isSetupComplete = false;
let priceUpdateHandlers: ((update: PriceUpdate) => void)[] = [];

/**
 * Initialize WebSocket price streams
 * Call this once on server startup
 */
export async function setupPriceStreams(): Promise<void> {
  if (isSetupComplete) {
    console.log('[Setup] Price streams already initialized');
    return;
  }

  console.log('[Setup] Initializing price streams...');

  const manager = getPriceStreamManager();

  // Register handler for all price updates
  manager.onPriceUpdate((update) => {
    // Notify all registered handlers
    priceUpdateHandlers.forEach((handler) => {
      try {
        handler(update);
      } catch (error) {
        console.error('[Setup] Price handler error:', error);
      }
    });
  });

  // Initialize streams
  await manager.initialize();

  isSetupComplete = true;
  console.log('[Setup] Price streams ready');
}

/**
 * Register a handler for real-time price updates
 */
export function onRealtimePriceUpdate(
  handler: (update: PriceUpdate) => void
): () => void {
  priceUpdateHandlers.push(handler);
  return () => {
    priceUpdateHandlers = priceUpdateHandlers.filter((h) => h !== handler);
  };
}

/**
 * Subscribe a specific token to real-time updates
 */
export async function subscribeToken(
  chainId: 'ethereum' | 'base' | 'solana',
  tokenAddress: string,
  poolInfo?: {
    poolAddress: string;
    // EVM
    isToken0?: boolean;
    decimals0?: number;
    decimals1?: number;
    // Solana
    quoteMint?: string;
    tokenDecimals?: number;
    quoteDecimals?: number;
  }
): Promise<void> {
  if (!poolInfo) {
    console.log(`[Setup] No pool info for ${chainId}:${tokenAddress}, skipping subscription`);
    return;
  }

  const manager = getPriceStreamManager();

  if (chainId === 'solana') {
    manager.addPool({
      chainId,
      tokenAddress,
      poolAddress: poolInfo.poolAddress,
      quoteMint: poolInfo.quoteMint,
      tokenDecimals: poolInfo.tokenDecimals,
      quoteDecimals: poolInfo.quoteDecimals,
    });
  } else {
    manager.addPool({
      chainId,
      tokenAddress,
      poolAddress: poolInfo.poolAddress,
      isToken0: poolInfo.isToken0,
      decimals0: poolInfo.decimals0,
      decimals1: poolInfo.decimals1,
    });
  }
}

/**
 * Get the latest cached price for a token
 */
export function getCachedPrice(
  chainId: 'ethereum' | 'base' | 'solana',
  tokenAddress: string
): number | undefined {
  const manager = getPriceStreamManager();
  const update = manager.getLatestPrice(chainId, tokenAddress);
  return update?.price;
}

/**
 * Check if streams are setup
 */
export function isStreamsReady(): boolean {
  return isSetupComplete;
}
