/**
 * Rate limiter for external API calls
 * Prevents quota exhaustion from agent batch requests
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();

  async checkLimit(
    service: string,
    maxPerMinute: number
  ): Promise<{ allowed: boolean; retryAfter?: number; remaining: number }> {
    const key = service;
    const now = Date.now();
    const limit = this.limits.get(key);

    // Reset if past the minute window
    if (!limit || now > limit.resetAt) {
      this.limits.set(key, { count: 1, resetAt: now + 60000 });
      return { allowed: true, remaining: maxPerMinute - 1 };
    }

    // Check if under limit
    if (limit.count < maxPerMinute) {
      limit.count++;
      return { allowed: true, remaining: maxPerMinute - limit.count };
    }

    // Rate limited
    const retryAfter = Math.ceil((limit.resetAt - now) / 1000);
    return { allowed: false, retryAfter, remaining: 0 };
  }

  // Get current usage for a service
  getUsage(service: string): { count: number; resetAt: number } | null {
    return this.limits.get(service) || null;
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
