import { NextResponse } from 'next/server';
import { getCorsHeaders, API_VERSION } from '@/lib/api/utils';
import { apiCache } from '@/lib/api/cache';
import { rateLimiter, API_LIMITS } from '@/lib/api/rate-limiter';

export const runtime = 'edge';

interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  error?: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    goplus: ServiceHealth;
    dexscreener: ServiceHealth;
    geckoterminal: ServiceHealth;
    database: ServiceHealth;
  };
  cache: {
    hitRate: number;
    size: number;
  };
  rateLimits: Record<string, { count: number; remaining: number }>;
}

export async function GET() {
  const startTime = Date.now();

  // Check all services in parallel
  const [goplus, dexscreener, geckoterminal, database] = await Promise.all([
    checkGoPlus(),
    checkDexScreener(),
    checkGeckoTerminal(),
    checkDatabase(),
  ]);

  const services = { goplus, dexscreener, geckoterminal, database };

  // Determine overall health
  const serviceStatuses = Object.values(services).map(s => s.status);
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (serviceStatuses.every(s => s === 'down')) {
    overallStatus = 'unhealthy';
  } else if (serviceStatuses.some(s => s === 'down' || s === 'degraded')) {
    overallStatus = 'degraded';
  }

  // Get cache stats
  const cacheStats = apiCache.getStats();

  // Get rate limit status
  const rateLimits: Record<string, { count: number; remaining: number }> = {};
  for (const [service, limit] of Object.entries(API_LIMITS)) {
    const usage = rateLimiter.getUsage(service);
    rateLimits[service] = {
      count: usage?.count || 0,
      remaining: limit - (usage?.count || 0),
    };
  }

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: API_VERSION,
    services,
    cache: {
      hitRate: Math.round(cacheStats.hitRate * 100) / 100,
      size: cacheStats.size,
    },
    rateLimits,
  };

  const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      ...getCorsHeaders(),
      'X-Response-Time': `${Date.now() - startTime}ms`,
    },
  });
}

async function checkGoPlus(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const response = await fetch('https://api.gopluslabs.io/api/v1/supported_chains', {
      signal: AbortSignal.timeout(5000),
    });
    return {
      status: response.ok ? 'up' : 'degraded',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

async function checkDexScreener(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const response = await fetch('https://api.dexscreener.com/latest/dex/tokens/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', {
      signal: AbortSignal.timeout(5000),
    });
    return {
      status: response.ok ? 'up' : 'degraded',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

async function checkGeckoTerminal(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const response = await fetch('https://api.geckoterminal.com/api/v2/networks', {
      signal: AbortSignal.timeout(5000),
    });
    return {
      status: response.ok ? 'up' : 'degraded',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    // Simple check - try to import supabase (will fail if env vars missing)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return {
        status: 'down',
        error: 'Database URL not configured',
      };
    }

    // Could add actual DB ping here, but keeping it light for health check
    return {
      status: 'up',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}
