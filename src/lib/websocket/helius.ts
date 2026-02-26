/**
 * Helius WebSocket client for real-time Solana price feeds
 * Subscribes to DEX swap transactions (Raydium, Orca, Meteora)
 *
 * Requires: Helius paid plan for WebSocket access
 */

// Known Solana DEX program IDs
const RAYDIUM_V4 = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
const RAYDIUM_CLMM = 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK';
const ORCA_WHIRLPOOL = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
const METEORA_DLMM = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo';

interface PriceUpdate {
  chainId: 'solana';
  tokenAddress: string;
  poolAddress: string;
  price: number;
  timestamp: number;
}

type PriceUpdateCallback = (update: PriceUpdate) => void;

interface PoolSubscription {
  tokenAddress: string;
  poolAddress: string;
  quoteMint: string; // USDC, SOL, etc.
  tokenDecimals: number;
  quoteDecimals: number;
}

export class HeliusPriceStream {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, PoolSubscription> = new Map();
  private callbacks: Set<PriceUpdateCallback> = new Set();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnected = false;
  private wssUrl: string;
  private subscriptionId = 0;

  constructor() {
    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      throw new Error('HELIUS_API_KEY not configured');
    }

    this.wssUrl = `wss://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  }

  /**
   * Connect to Helius WebSocket
   */
  connect(): void {
    if (this.ws) {
      this.ws.close();
    }

    try {
      this.ws = new WebSocket(this.wssUrl);

      this.ws.onopen = () => {
        console.log('[Helius Solana] WebSocket connected');
        this.isConnected = true;

        // Subscribe to all pools
        this.subscriptions.forEach((sub, poolAddress) => {
          this.subscribeToPool(poolAddress);
        });
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('[Helius Solana] WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('[Helius Solana] WebSocket disconnected');
        this.isConnected = false;

        // Reconnect after 5 seconds
        this.reconnectTimeout = setTimeout(() => {
          this.connect();
        }, 5000);
      };
    } catch (error) {
      console.error('[Helius Solana] Connection failed:', error);
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
    quoteMint: string,
    tokenDecimals: number,
    quoteDecimals: number
  ): void {
    const sub: PoolSubscription = {
      tokenAddress,
      poolAddress,
      quoteMint,
      tokenDecimals,
      quoteDecimals,
    };

    this.subscriptions.set(poolAddress, sub);

    if (this.isConnected && this.ws) {
      this.subscribeToPool(poolAddress);
    }
  }

  /**
   * Remove pool subscription
   */
  removePool(poolAddress: string): void {
    this.subscriptions.delete(poolAddress);
    // Would need to unsubscribe - Helius supports this
  }

  /**
   * Register callback for price updates
   */
  onPriceUpdate(callback: PriceUpdateCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Subscribe to account changes for a pool
   * Using accountSubscribe to watch pool state changes
   */
  private subscribeToPool(poolAddress: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.subscriptionId++;

    // Subscribe to account changes on the pool
    const subscribeMsg = {
      jsonrpc: '2.0',
      id: this.subscriptionId,
      method: 'accountSubscribe',
      params: [
        poolAddress,
        {
          encoding: 'jsonParsed',
          commitment: 'confirmed',
        },
      ],
    };

    this.ws.send(JSON.stringify(subscribeMsg));
    console.log(`[Helius Solana] Subscribed to pool ${poolAddress}`);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const msg = JSON.parse(data);

      // Subscription confirmation
      if (msg.result !== undefined && typeof msg.id === 'number') {
        console.log(`[Helius Solana] Subscription confirmed: ${msg.result}`);
        return;
      }

      // Account notification
      if (msg.method === 'accountNotification' && msg.params?.result?.value) {
        this.processAccountUpdate(msg.params.result.value);
      }
    } catch (error) {
      console.error('[Helius Solana] Message parse error:', error);
    }
  }

  /**
   * Process account update and extract price
   * This handles Raydium AMM pool state
   */
  private processAccountUpdate(accountInfo: {
    data: { parsed?: { info?: Record<string, unknown> } } | string;
    owner: string;
  }): void {
    try {
      const owner = accountInfo.owner;

      // Determine pool type and parse accordingly
      if (owner === RAYDIUM_V4) {
        this.parseRaydiumV4(accountInfo);
      } else if (owner === RAYDIUM_CLMM) {
        this.parseRaydiumCLMM(accountInfo);
      } else if (owner === ORCA_WHIRLPOOL) {
        this.parseOrcaWhirlpool(accountInfo);
      } else if (owner === METEORA_DLMM) {
        this.parseMeteoraDLMM(accountInfo);
      }
    } catch (error) {
      console.error('[Helius Solana] Account parse error:', error);
    }
  }

  /**
   * Parse Raydium V4 AMM pool state
   * Pool state contains tokenAAmount and tokenBAmount
   */
  private parseRaydiumV4(accountInfo: {
    data: { parsed?: { info?: Record<string, unknown> } } | string;
  }): void {
    // Raydium V4 pool layout parsing
    // In production, would use @raydium-io/raydium-sdk to decode
    // For now, using simplified approach with token amounts

    if (typeof accountInfo.data === 'object' && accountInfo.data.parsed?.info) {
      const info = accountInfo.data.parsed.info;

      // Find matching subscription and calculate price
      // This is a simplified version - full implementation would
      // decode the actual pool state bytes
      console.log('[Helius Solana] Raydium V4 update:', info);
    }
  }

  /**
   * Parse Raydium CLMM (Concentrated Liquidity) pool
   */
  private parseRaydiumCLMM(accountInfo: {
    data: { parsed?: { info?: Record<string, unknown> } } | string;
  }): void {
    // CLMM uses sqrtPriceX64 similar to Uniswap V3
    if (typeof accountInfo.data === 'object' && accountInfo.data.parsed?.info) {
      const info = accountInfo.data.parsed.info;
      console.log('[Helius Solana] Raydium CLMM update:', info);
    }
  }

  /**
   * Parse Orca Whirlpool state
   * Uses sqrtPrice similar to Uniswap V3
   */
  private parseOrcaWhirlpool(accountInfo: {
    data: { parsed?: { info?: Record<string, unknown> } } | string;
  }): void {
    if (typeof accountInfo.data === 'object' && accountInfo.data.parsed?.info) {
      const info = accountInfo.data.parsed.info;
      console.log('[Helius Solana] Orca Whirlpool update:', info);
    }
  }

  /**
   * Parse Meteora DLMM pool state
   */
  private parseMeteoraDLMM(accountInfo: {
    data: { parsed?: { info?: Record<string, unknown> } } | string;
  }): void {
    if (typeof accountInfo.data === 'object' && accountInfo.data.parsed?.info) {
      const info = accountInfo.data.parsed.info;
      console.log('[Helius Solana] Meteora DLMM update:', info);
    }
  }

  /**
   * Calculate price from pool reserves
   */
  private calculatePrice(
    tokenAmount: bigint,
    quoteAmount: bigint,
    tokenDecimals: number,
    quoteDecimals: number
  ): number {
    if (tokenAmount === 0n) return 0;

    const decimalsAdjust = quoteDecimals - tokenDecimals;
    const price =
      (Number(quoteAmount) / Number(tokenAmount)) *
      Math.pow(10, decimalsAdjust);

    return price;
  }

  /**
   * Emit price update to all callbacks
   */
  private emitPriceUpdate(
    sub: PoolSubscription,
    price: number
  ): void {
    if (price <= 0) return;

    const update: PriceUpdate = {
      chainId: 'solana',
      tokenAddress: sub.tokenAddress,
      poolAddress: sub.poolAddress,
      price,
      timestamp: Date.now(),
    };

    this.callbacks.forEach((cb) => cb(update));
  }
}

/**
 * Alternative: Use Helius Enhanced Transactions WebSocket
 * This subscribes to parsed transactions for specific accounts
 * More reliable for catching swaps vs raw account changes
 */
export class HeliusTransactionStream {
  private ws: WebSocket | null = null;
  private callbacks: Set<PriceUpdateCallback> = new Set();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnected = false;
  private trackedPools: Map<string, PoolSubscription> = new Map();

  constructor() {
    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      throw new Error('HELIUS_API_KEY not configured');
    }

    // Enhanced WebSocket endpoint for parsed transactions
    this.ws = null;
  }

  /**
   * Connect using Helius Enhanced API
   * Subscribes to transaction logs for DEX programs
   */
  connect(): void {
    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) return;

    try {
      // Use standard Solana WebSocket with Helius
      this.ws = new WebSocket(`wss://mainnet.helius-rpc.com/?api-key=${apiKey}`);

      this.ws.onopen = () => {
        console.log('[Helius TX] WebSocket connected');
        this.isConnected = true;

        // Subscribe to logs from DEX programs
        this.subscribeToDexPrograms();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('[Helius TX] WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('[Helius TX] WebSocket disconnected');
        this.isConnected = false;

        this.reconnectTimeout = setTimeout(() => {
          this.connect();
        }, 5000);
      };
    } catch (error) {
      console.error('[Helius TX] Connection failed:', error);
    }
  }

  /**
   * Subscribe to logs from major DEX programs
   */
  private subscribeToDexPrograms(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const dexPrograms = [
      RAYDIUM_V4,
      RAYDIUM_CLMM,
      ORCA_WHIRLPOOL,
      METEORA_DLMM,
    ];

    dexPrograms.forEach((program, idx) => {
      const subscribeMsg = {
        jsonrpc: '2.0',
        id: idx + 1,
        method: 'logsSubscribe',
        params: [
          { mentions: [program] },
          { commitment: 'confirmed' },
        ],
      };

      this.ws!.send(JSON.stringify(subscribeMsg));
      console.log(`[Helius TX] Subscribed to ${program}`);
    });
  }

  /**
   * Handle incoming transaction logs
   */
  private handleMessage(data: string): void {
    try {
      const msg = JSON.parse(data);

      if (msg.method === 'logsNotification' && msg.params?.result?.value) {
        const logs = msg.params.result.value.logs;
        const signature = msg.params.result.value.signature;

        // Parse swap from logs
        this.parseSwapLogs(logs, signature);
      }
    } catch (error) {
      console.error('[Helius TX] Message parse error:', error);
    }
  }

  /**
   * Parse swap transaction logs to extract price
   */
  private parseSwapLogs(logs: string[], signature: string): void {
    // Look for swap instruction logs
    const swapLog = logs.find(
      (log) =>
        log.includes('Swap') ||
        log.includes('swap') ||
        log.includes('SwapBaseIn') ||
        log.includes('SwapBaseOut')
    );

    if (swapLog) {
      // Would need to fetch full transaction to get amounts
      // Using Helius Enhanced API: GET /v0/transactions/{signature}
      console.log(`[Helius TX] Swap detected: ${signature}`);
    }
  }

  /**
   * Track a pool for price updates
   */
  addPool(
    tokenAddress: string,
    poolAddress: string,
    quoteMint: string,
    tokenDecimals: number,
    quoteDecimals: number
  ): void {
    this.trackedPools.set(poolAddress, {
      tokenAddress,
      poolAddress,
      quoteMint,
      tokenDecimals,
      quoteDecimals,
    });
  }

  /**
   * Register callback for price updates
   */
  onPriceUpdate(callback: PriceUpdateCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
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
}

/**
 * Create Solana price stream
 */
export function createSolanaPriceStream(): HeliusPriceStream | null {
  try {
    return new HeliusPriceStream();
  } catch (error) {
    console.error('Failed to create Solana price stream:', error);
    return null;
  }
}
