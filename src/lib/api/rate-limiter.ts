/**
 * Rate limiter for external API calls
 * Prevents quota exhaustion from agent batch requests
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
  queue: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
  }>;
}

interface RateLimitStats {
  service: string;
  count: number;
  limit: number;
  resetAt: number;
  queueLength: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private stats: Map<string, { total: number; rejected: number; queued: number }> = new Map();

  async checkLimit(
    service: string,
    maxPerMinute: number
  ): Promise<{ allowed: boolean; retryAfter?: number; remaining: number }> {
    const key = service;
    const now = Date.now();
    let limit = this.limits.get(key);

    // Initialize stats tracking
    if (!this.stats.has(key)) {
      this.stats.set(key, { total: 0, rejected: 0, queued: 0 });
    }
    const stat = this.stats.get(key)!;
    stat.total++;

    // Reset if past the minute window
    if (!limit || now > limit.resetAt) {
      this.limits.set(key, { count: 1, resetAt: now + 60000, queue: [] });
      return { allowed: true, remaining: maxPerMinute - 1 };
    }

    // Check if under limit
    if (limit.count < maxPerMinute) {
      limit.count++;
      return { allowed: true, remaining: maxPerMinute - limit.count };
    }

    // Rate limited
    stat.rejected++;
    const retryAfter = Math.ceil((limit.resetAt - now) / 1000);
    return { allowed: false, retryAfter, remaining: 0 };
  }

  /**
   * Wait for rate limit slot (queued execution)
   * Use this when you'd rather wait than fail
   */
  async waitForSlot(service: string, maxPerMinute: number, timeoutMs = 30000): Promise<void> {
    const check = await this.checkLimit(service, maxPerMinute);
    if (check.allowed) return;

    const stat = this.stats.get(service);
    if (stat) stat.queued++;

    const limit = this.limits.get(service);
    if (!limit) return;

    // Wait for next window
    const waitTime = limit.resetAt - Date.now();
    if (waitTime > timeoutMs) {
      throw new RateLimitError(
        `${service} rate limit exceeded. Wait time ${waitTime}ms exceeds timeout.`,
        service,
        Math.ceil(waitTime / 1000)
      );
    }

    await new Promise<void>((resolve) => setTimeout(resolve, waitTime + 10));
    // Retry after waiting
    await this.checkLimit(service, maxPerMinute);
  }

  // Get current usage for a service
  getUsage(service: string): { count: number; resetAt: number } | null {
    const limit = this.limits.get(service);
    return limit ? { count: limit.count, resetAt: limit.resetAt } : null;
  }

  // Get all stats for monitoring
  getAllStats(): RateLimitStats[] {
    const result: RateLimitStats[] = [];
    for (const [service, entry] of this.limits.entries()) {
      result.push({
        service,
        count: entry.count,
        limit: API_LIMITS[service as ApiService] || 0,
        resetAt: entry.resetAt,
        queueLength: entry.queue.length,
      });
    }
    return result;
  }

  // Get aggregate stats for monitoring dashboard
  getAggregateStats(): Record<string, { total: number; rejected: number; queued: number }> {
    return Object.fromEntries(this.stats);
  }

  // Reset a specific service's counter
  reset(service: string): void {
    this.limits.delete(service);
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetAt) {
        this.limits.delete(key);
      }
    }
  }
}

export const rateLimiter = new RateLimiter();

// API call limits per minute (adjust based on your tier)
export const API_LIMITS = {
  goplus: 60,        // GoPlus: ~60 requests/min on free tier
  dexscreener: 300,  // DexScreener: ~300 requests/min
  helius: 100,       // Helius: varies by plan
  alchemy: 330,      // Alchemy: ~330 compute units/sec (adjusted for safety)
  geckoterminal: 30, // GeckoTerminal: ~30 requests/min
} as const;

export type ApiService = keyof typeof API_LIMITS;

/**
 * Check rate limit before making an API call
 * Throws an error if rate limited
 */
export async function checkRateLimit(service: ApiService): Promise<void> {
  const limit = API_LIMITS[service];
  const check = await rateLimiter.checkLimit(service, limit);

  if (!check.allowed) {
    throw new RateLimitError(
      `${service} rate limit exceeded. Retry after ${check.retryAfter}s`,
      service,
      check.retryAfter || 60
    );
  }
}

/**
 * Rate limit error with retry information
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public service: string,
    public retryAfter: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// Run cleanup every 5 minutes in long-running processes
if (typeof setInterval !== 'undefined') {
  setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);
}
