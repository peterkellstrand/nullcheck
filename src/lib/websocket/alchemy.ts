/**
 * Alchemy WebSocket client for real-time EVM price feeds
 * Subscribes to Swap events on Uniswap V2/V3 pools
 *
 * Requires: Alchemy Growth tier ($49/mo) for reliable WebSocket connections
 */

import { ChainId } from '@/types/chain';

// Uniswap V2 Swap event signature
const UNISWAP_V2_SWAP_TOPIC = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';

// Uniswap V3 Swap event signature
const UNISWAP_V3_SWAP_TOPIC = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';

interface PriceUpdate {
  chainId: ChainId;
  tokenAddress: string;
  poolAddress: string;
  price: number;
  timestamp: number;
}

type PriceUpdateCallback = (update: PriceUpdate) => void;

interface PoolSubscription {
  chainId: ChainId;
  tokenAddress: string;
  poolAddress: string;
  isToken0: boolean; // Is our token token0 in the pair?
  decimals0: number;
  decimals1: number;
}

export class AlchemyPriceStream {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, PoolSubscription> = new Map();
  private callbacks: Set<PriceUpdateCallback> = new Set();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnected = false;
  private chainId: ChainId;
  private wssUrl: string;

  constructor(chainId: 'ethereum' | 'base') {
    this.chainId = chainId;

    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      throw new Error('ALCHEMY_API_KEY not configured');
    }

    // Alchemy WSS endpoints
    const endpoints: Record<string, string> = {
      ethereum: `wss://eth-mainnet.g.alchemy.com/v2/${apiKey}`,
      base: `wss://base-mainnet.g.alchemy.com/v2/${apiKey}`,
    };

    this.wssUrl = endpoints[chainId];
  }

  /**
   * Connect to Alchemy WebSocket
   */
  connect(): void {
    if (this.ws) {
      this.ws.close();
    }

    try {
      this.ws = new WebSocket(this.wssUrl);

      this.ws.onopen = () => {
        console.log(`[Alchemy ${this.chainId}] WebSocket connected`);
        this.isConnected = true;

        // Resubscribe to all pools
        this.subscriptions.forEach((sub, poolAddress) => {
          this.subscribeToPool(poolAddress, sub);
        });
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error(`[Alchemy ${this.chainId}] WebSocket error:`, error);
      };

      this.ws.onclose = () => {
        console.log(`[Alchemy ${this.chainId}] WebSocket disconnected`);
        this.isConnected = false;

        // Reconnect after 5 seconds
        this.reconnectTimeout = setTimeout(() => {
          this.connect();
        }, 5000);
      };
    } catch (error) {
      console.error(`[Alchemy ${this.chainId}] Connection failed:`, error);
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Subscribe to price updates for a token's pool
   */
  addPool(
    tokenAddress: string,
    poolAddress: string,
    isToken0: boolean,
    decimals0: number,
    decimals1: number
  ): void {
    const sub: PoolSubscription = {
      chainId: this.chainId,
      tokenAddress: tokenAddress.toLowerCase(),
      poolAddress: poolAddress.toLowerCase(),
      isToken0,
      decimals0,
      decimals1,
    };

    this.subscriptions.set(poolAddress.toLowerCase(), sub);

    if (this.isConnected && this.ws) {
      this.subscribeToPool(poolAddress, sub);
    }
  }

  /**
   * Remove pool subscription
   */
  removePool(poolAddress: string): void {
    this.subscriptions.delete(poolAddress.toLowerCase());
    // Note: Alchemy doesn't have unsubscribe, would need to reconnect
  }

  /**
   * Register callback for price updates
   */
  onPriceUpdate(callback: PriceUpdateCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Subscribe to Swap events for a pool
   */
  private subscribeToPool(poolAddress: string, sub: PoolSubscription): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Subscribe to both V2 and V3 swap events
    const subscribeMsg = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_subscribe',
      params: [
        'logs',
        {
          address: poolAddress,
          topics: [[UNISWAP_V2_SWAP_TOPIC, UNISWAP_V3_SWAP_TOPIC]],
        },
      ],
    };

    this.ws.send(JSON.stringify(subscribeMsg));
    console.log(`[Alchemy ${this.chainId}] Subscribed to pool ${poolAddress}`);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const msg = JSON.parse(data);

      // Subscription confirmation
      if (msg.result && typeof msg.result === 'string') {
        console.log(`[Alchemy ${this.chainId}] Subscription confirmed: ${msg.result}`);
        return;
      }

      // Log event
      if (msg.params?.result) {
        const log = msg.params.result;
        this.processSwapLog(log);
      }
    } catch (error) {
      console.error(`[Alchemy ${this.chainId}] Message parse error:`, error);
    }
  }

  /**
   * Process a Swap event log and extract price
   */
  private processSwapLog(log: {
    address: string;
    topics: string[];
    data: string;
  }): void {
    const poolAddress = log.address.toLowerCase();
    const sub = this.subscriptions.get(poolAddress);

    if (!sub) return;

    try {
      let price: number;

      if (log.topics[0] === UNISWAP_V2_SWAP_TOPIC) {
        price = this.parseV2Swap(log.data, sub);
      } else if (log.topics[0] === UNISWAP_V3_SWAP_TOPIC) {
        price = this.parseV3Swap(log.data, sub);
      } else {
        return;
      }

      if (price > 0) {
        const update: PriceUpdate = {
          chainId: sub.chainId,
          tokenAddress: sub.tokenAddress,
          poolAddress: sub.poolAddress,
          price,
          timestamp: Date.now(),
        };

        // Notify all callbacks
        this.callbacks.forEach((cb) => cb(update));
      }
    } catch (error) {
      console.error(`[Alchemy ${this.chainId}] Swap parse error:`, error);
    }
  }

  /**
   * Parse Uniswap V2 Swap event
   * event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)
   */
  private parseV2Swap(data: string, sub: PoolSubscription): number {
    // Remove 0x prefix and split into 32-byte chunks
    const hex = data.slice(2);
    const amount0In = BigInt('0x' + hex.slice(0, 64));
    const amount1In = BigInt('0x' + hex.slice(64, 128));
    const amount0Out = BigInt('0x' + hex.slice(128, 192));
    const amount1Out = BigInt('0x' + hex.slice(192, 256));

    // Determine swap direction and calculate price
    let tokenAmount: bigint;
    let quoteAmount: bigint;

    if (sub.isToken0) {
      // Token is token0, quote is token1
      tokenAmount = amount0In > 0n ? amount0In : amount0Out;
      quoteAmount = amount1In > 0n ? amount1In : amount1Out;
    } else {
      // Token is token1, quote is token0
      tokenAmount = amount1In > 0n ? amount1In : amount1Out;
      quoteAmount = amount0In > 0n ? amount0In : amount0Out;
    }

    if (tokenAmount === 0n) return 0;

    // Calculate price (quote per token)
    const decimalsAdjust = sub.isToken0
      ? sub.decimals1 - sub.decimals0
      : sub.decimals0 - sub.decimals1;

    const price =
      Number(quoteAmount) / Number(tokenAmount) * Math.pow(10, decimalsAdjust);

    return price;
  }

  /**
   * Parse Uniswap V3 Swap event
   * event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)
   */
  private parseV3Swap(data: string, sub: PoolSubscription): number {
    // Remove 0x prefix
    const hex = data.slice(2);

    // amount0 and amount1 are signed int256
    const amount0Hex = hex.slice(0, 64);
    const amount1Hex = hex.slice(64, 128);

    // Parse as signed integers
    const amount0 = this.parseSignedInt256(amount0Hex);
    const amount1 = this.parseSignedInt256(amount1Hex);

    // In V3, negative = token left pool (sold), positive = token entered pool (bought)
    let tokenAmount: bigint;
    let quoteAmount: bigint;

    if (sub.isToken0) {
      tokenAmount = amount0 < 0n ? -amount0 : amount0;
      quoteAmount = amount1 < 0n ? -amount1 : amount1;
    } else {
      tokenAmount = amount1 < 0n ? -amount1 : amount1;
      quoteAmount = amount0 < 0n ? -amount0 : amount0;
    }

    if (tokenAmount === 0n) return 0;

    const decimalsAdjust = sub.isToken0
      ? sub.decimals1 - sub.decimals0
      : sub.decimals0 - sub.decimals1;

    const price =
      Number(quoteAmount) / Number(tokenAmount) * Math.pow(10, decimalsAdjust);

    return price;
  }

  /**
   * Parse a hex string as signed int256
   */
  private parseSignedInt256(hex: string): bigint {
    const value = BigInt('0x' + hex);
    const maxPositive = BigInt(2) ** BigInt(255);

    if (value >= maxPositive) {
      // Negative number (two's complement)
      return value - BigInt(2) ** BigInt(256);
    }
    return value;
  }
}

/**
 * Create price streams for all EVM chains
 */
export function createEvmPriceStreams(): Map<ChainId, AlchemyPriceStream> {
  const streams = new Map<ChainId, AlchemyPriceStream>();

  try {
    streams.set('ethereum', new AlchemyPriceStream('ethereum'));
    streams.set('base', new AlchemyPriceStream('base'));
  } catch (error) {
    console.error('Failed to create EVM price streams:', error);
  }

  return streams;
}
