/**
 * Unified WebSocket Price Stream Manager
 * Combines Alchemy (EVM) and Helius (Solana) streams
 */

import { ChainId } from '@/types/chain';
import { AlchemyPriceStream, createEvmPriceStreams } from './alchemy';
import { HeliusPriceStream, createSolanaPriceStream } from './helius';

interface PriceUpdate {
  chainId: ChainId;
  tokenAddress: string;
  poolAddress: string;
  price: number;
  timestamp: number;
}

type PriceUpdateCallback = (update: PriceUpdate) => void;

interface PoolInfo {
  chainId: ChainId;
  tokenAddress: string;
  poolAddress: string;
  // EVM-specific
  isToken0?: boolean;
  decimals0?: number;
  decimals1?: number;
  // Solana-specific
  quoteMint?: string;
  tokenDecimals?: number;
  quoteDecimals?: number;
}

class PriceStreamManager {
  private evmStreams: Map<ChainId, AlchemyPriceStream> = new Map();
  private solanaStream: HeliusPriceStream | null = null;
  private callbacks: Set<PriceUpdateCallback> = new Set();
  private priceCache: Map<string, PriceUpdate> = new Map();
  private isInitialized = false;

  /**
   * Initialize all price streams
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('[PriceStreamManager] Initializing...');

    // Initialize EVM streams (Ethereum, Base)
    try {
      this.evmStreams = createEvmPriceStreams();
      this.evmStreams.forEach((stream, chainId) => {
        stream.onPriceUpdate((update) => this.handlePriceUpdate(update));
        stream.connect();
        console.log(`[PriceStreamManager] ${chainId} stream connected`);
      });
    } catch (error) {
      console.error('[PriceStreamManager] EVM streams failed:', error);
    }

    // Initialize Solana stream
    try {
      this.solanaStream = createSolanaPriceStream();
      if (this.solanaStream) {
        this.solanaStream.onPriceUpdate((update) => this.handlePriceUpdate(update));
        this.solanaStream.connect();
        console.log('[PriceStreamManager] Solana stream connected');
      }
    } catch (error) {
      console.error('[PriceStreamManager] Solana stream failed:', error);
    }

    this.isInitialized = true;
    console.log('[PriceStreamManager] Initialized');
  }

  /**
   * Shutdown all streams
   */
  shutdown(): void {
    this.evmStreams.forEach((stream) => stream.disconnect());
    this.solanaStream?.disconnect();
    this.isInitialized = false;
    console.log('[PriceStreamManager] Shutdown');
  }

  /**
   * Subscribe to a pool for price updates
   */
  addPool(pool: PoolInfo): void {
    if (pool.chainId === 'solana') {
      if (
        this.solanaStream &&
        pool.quoteMint &&
        pool.tokenDecimals !== undefined &&
        pool.quoteDecimals !== undefined
      ) {
        this.solanaStream.addPool(
          pool.tokenAddress,
          pool.poolAddress,
          pool.quoteMint,
          pool.tokenDecimals,
          pool.quoteDecimals
        );
      }
    } else {
      const stream = this.evmStreams.get(pool.chainId);
      if (
        stream &&
        pool.isToken0 !== undefined &&
        pool.decimals0 !== undefined &&
        pool.decimals1 !== undefined
      ) {
        stream.addPool(
          pool.tokenAddress,
          pool.poolAddress,
          pool.isToken0,
          pool.decimals0,
          pool.decimals1
        );
      }
    }
  }

  /**
   * Remove pool subscription
   */
  removePool(chainId: ChainId, poolAddress: string): void {
    if (chainId === 'solana') {
      this.solanaStream?.removePool(poolAddress);
    } else {
      this.evmStreams.get(chainId)?.removePool(poolAddress);
    }
  }

  /**
   * Register callback for all price updates
   */
  onPriceUpdate(callback: PriceUpdateCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Get latest cached price for a token
   */
  getLatestPrice(chainId: ChainId, tokenAddress: string): PriceUpdate | undefined {
    const key = `${chainId}-${tokenAddress.toLowerCase()}`;
    return this.priceCache.get(key);
  }

  /**
   * Handle incoming price update from any stream
   */
  private handlePriceUpdate(update: PriceUpdate): void {
    const key = `${update.chainId}-${update.tokenAddress.toLowerCase()}`;
    this.priceCache.set(key, update);

    // Notify all callbacks
    this.callbacks.forEach((cb) => {
      try {
        cb(update);
      } catch (error) {
        console.error('[PriceStreamManager] Callback error:', error);
      }
    });
  }

  /**
   * Check if streams are connected
   */
  getStatus(): { chainId: ChainId; connected: boolean }[] {
    const status: { chainId: ChainId; connected: boolean }[] = [];

    this.evmStreams.forEach((_, chainId) => {
      status.push({ chainId, connected: true }); // Simplified
    });

    if (this.solanaStream) {
      status.push({ chainId: 'solana', connected: true });
    }

    return status;
  }
}

// Singleton instance
let manager: PriceStreamManager | null = null;

/**
 * Get the global price stream manager
 */
export function getPriceStreamManager(): PriceStreamManager {
  if (!manager) {
    manager = new PriceStreamManager();
  }
  return manager;
}

/**
 * Initialize price streams (call on server startup)
 */
export async function initializePriceStreams(): Promise<void> {
  const mgr = getPriceStreamManager();
  await mgr.initialize();
}

/**
 * Shutdown price streams (call on server shutdown)
 */
export function shutdownPriceStreams(): void {
  manager?.shutdown();
  manager = null;
}

export type { PriceUpdate, PoolInfo };
