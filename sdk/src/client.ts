/**
 * nullcheck TypeScript SDK Client
 *
 * Type-safe client for the nullcheck DeFi risk analysis API.
 * Works in any JavaScript runtime: Node.js, Deno, Bun, Cloudflare Workers, browsers.
 *
 * @example
 * ```typescript
 * import { createNullcheck } from '@nullcheck/sdk';
 *
 * const nc = createNullcheck({ apiKey: 'nk_your_key_here' });
 *
 * // Check if a token is safe before trading
 * const risk = await nc.analyzeRisk('solana', 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
 * if (risk.honeypot?.isHoneypot) {
 *   console.log('HONEYPOT DETECTED — do not buy!');
 * } else if (risk.level === 'low') {
 *   console.log('Token looks safe.');
 * }
 * ```
 */

import type {
  ApiResponse,
  BatchRiskResult,
  ChainId,
  NullcheckOptions,
  RiskScore,
  TokenHolder,
  TokenWithMetrics,
  WhaleActivity,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.nullcheck.io';
const DEFAULT_TIMEOUT_MS = 30_000;

export class NullcheckClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(options: NullcheckOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.timeout = options.timeout || DEFAULT_TIMEOUT_MS;
  }

  // ── Risk Analysis ──────────────────────────────────────────

  /**
   * Analyze a token for honeypots, rug pulls, contract vulnerabilities, and liquidity risks.
   *
   * This is the primary safety check. ALWAYS call this before buying an unfamiliar token.
   *
   * @param chain - Blockchain network (ethereum, base, solana)
   * @param address - Token contract address
   * @param options.force - Bypass cache for fresh analysis (default: false)
   * @returns Risk score with breakdown across honeypot, contract, holders, and liquidity
   *
   * @example
   * ```typescript
   * const risk = await nc.analyzeRisk('solana', 'TOKEN_ADDRESS');
   * if (risk.level === 'critical' || risk.honeypot?.isHoneypot) {
   *   // DO NOT TRADE
   * }
   * ```
   */
  async analyzeRisk(chain: ChainId, address: string, options?: { force?: boolean }): Promise<RiskScore> {
    return this.post<RiskScore>(`/api/risk/${chain}/${address}`, {
      force: options?.force || false,
    });
  }

  /**
   * Get a cached risk analysis (if one exists). Returns null if never analyzed.
   * Use analyzeRisk() instead if you want guaranteed results.
   */
  async getCachedRisk(chain: ChainId, address: string): Promise<RiskScore | null> {
    try {
      return await this.get<RiskScore>(`/api/risk/${chain}/${address}`);
    } catch (error) {
      if (error instanceof NullcheckApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Screen multiple tokens in one request.
   * Far more efficient than calling analyzeRisk in a loop.
   *
   * Batch size limits: Developer (10), Professional (50), Business/Enterprise (100).
   *
   * @param tokens - Array of { chain, address } objects
   *
   * @example
   * ```typescript
   * const results = await nc.batchRisk([
   *   { chain: 'solana', address: 'TOKEN_A' },
   *   { chain: 'ethereum', address: '0xTOKEN_B' },
   * ]);
   * for (const [key, score] of Object.entries(results.results)) {
   *   console.log(`${key}: ${score.level} (${score.totalScore}/100)`);
   * }
   * ```
   */
  async batchRisk(tokens: Array<{ chain: ChainId; address: string }>): Promise<BatchRiskResult> {
    return this.post<BatchRiskResult>('/api/risk/batch', {
      tokens: tokens.map((t) => ({ chainId: t.chain, address: t.address })),
    });
  }

  // ── Token Data ─────────────────────────────────────────────

  /**
   * Get full token profile: identity, price metrics, and risk score (if previously analyzed).
   */
  async getToken(chain: ChainId, address: string): Promise<TokenWithMetrics> {
    return this.get<TokenWithMetrics>(`/api/token/${chain}/${address}`);
  }

  /**
   * Get currently trending tokens ranked by volume and activity.
   *
   * @param options.chain - Filter to specific chain (omit for all)
   * @param options.limit - Max results (1-100, default 50)
   */
  async getTrending(options?: { chain?: ChainId; limit?: number }): Promise<{
    tokens: TokenWithMetrics[];
    meta: { count: number; timestamp: string };
  }> {
    return this.get('/api/tokens', {
      chain: options?.chain,
      limit: options?.limit,
    });
  }

  /**
   * Search for a token by name, symbol, or contract address.
   *
   * @param query - Search term (min 2 chars). Name, symbol (e.g., "PEPE"), or address.
   * @param options.chain - Limit to specific chain
   * @param options.limit - Max results (default 20)
   */
  async search(query: string, options?: { chain?: ChainId; limit?: number }): Promise<{
    results: TokenWithMetrics[];
    count: number;
  }> {
    return this.get('/api/search', {
      q: query,
      chain: options?.chain,
      limit: options?.limit,
    });
  }

  // ── Whale Tracking ─────────────────────────────────────────

  /**
   * Get whale transaction activity for a token over the past 24 hours.
   *
   * Positive netFlow24h = accumulation (bullish). Negative = distribution (bearish).
   */
  async getWhaleActivity(chain: ChainId, address: string): Promise<WhaleActivity> {
    return this.get<WhaleActivity>(`/api/whale/activity/${chain}/${address}`);
  }

  /**
   * Get top token holders with concentration analysis.
   *
   * Check if top10 holders own > 50% (rug pull risk).
   */
  async getWhaleHolders(chain: ChainId, address: string): Promise<{
    holders: TokenHolder[];
    total: number;
    limit: number;
  }> {
    return this.get(`/api/whale/holders/${chain}/${address}`);
  }

  // ── HTTP Layer ─────────────────────────────────────────────

  private async get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return this.request<T>(url.toString(), { method: 'GET' });
  }

  private async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(new URL(path, this.baseUrl).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          'X-API-Key': this.apiKey,
          Accept: 'application/json',
          ...init.headers,
        },
      });

      const json = (await response.json()) as ApiResponse<T>;

      if (!response.ok || !json.success) {
        const code = json.error?.code || `HTTP_${response.status}`;
        const message = json.error?.message || response.statusText;
        throw new NullcheckApiError(code, message, response.status);
      }

      return json.data as T;
    } catch (error) {
      if (error instanceof NullcheckApiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new NullcheckApiError('TIMEOUT', `Request timed out after ${this.timeout / 1000}s`, 408);
      }
      throw new NullcheckApiError(
        'NETWORK_ERROR',
        `Failed to reach nullcheck API: ${error instanceof Error ? error.message : String(error)}`,
        0,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** Error thrown by the nullcheck API */
export class NullcheckApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'NullcheckApiError';
  }
}
