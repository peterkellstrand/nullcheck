/**
 * In-memory cache for external API responses
 * Reduces redundant API calls when multiple agents request the same data
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  service: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

class ApiCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private stats: CacheStats = { hits: 0, misses: 0, size: 0 };

  /**
   * Get cached value if exists and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size = this.cache.size;
      return null;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * Set value with TTL
   */
  set<T>(key: string, data: T, ttlMs: number, service: string = 'unknown'): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      service,
    });
    this.stats.size = this.cache.size;
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return result;
  }

  /**
   * Delete all keys for a specific service
   */
  invalidateService(service: string): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.service === service) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.size = this.cache.size;
    return count;
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    this.stats.size = this.cache.size;
    return cleaned;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Get or fetch with caching
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number,
    service: string
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttlMs, service);
    return data;
  }
}

export const apiCache = new ApiCache();

// Cache TTLs by data type (in milliseconds)
export const CACHE_TTL = {
  // Token security data - 5 minutes (changes rarely)
  tokenSecurity: 5 * 60 * 1000,

  // Token metrics - 30 seconds (prices change frequently)
  tokenMetrics: 30 * 1000,

  // Holder data - 5 minutes
  holderData: 5 * 60 * 1000,

  // Pool data - 1 minute
  poolData: 60 * 1000,

  // Trending tokens - 2 minutes
  trending: 2 * 60 * 1000,

  // Search results - 30 seconds
  search: 30 * 1000,
} as const;

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => apiCache.cleanup(), 5 * 60 * 1000);
}
