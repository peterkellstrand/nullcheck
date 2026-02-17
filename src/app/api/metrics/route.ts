import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAccess, createRateLimitHeaders } from '@/lib/auth/verify-api-access';
import { getCorsHeaders, generateRequestId, createErrorResponse, createSuccessResponse, ERROR_CODES } from '@/lib/api/utils';
import { apiCache } from '@/lib/api/cache';
import { rateLimiter, API_LIMITS } from '@/lib/api/rate-limiter';

export const runtime = 'nodejs';

interface MetricsResponse {
  account: {
    type: 'human' | 'agent';
    tier: string;
    userId: string;
  };
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: number;
    percentUsed: number;
  };
  cache: {
    hitRate: number;
    size: number;
    hits: number;
    misses: number;
  };
  externalApis: Record<string, {
    limitPerMinute: number;
    currentUsage: number;
    remaining: number;
  }>;
  timestamp: string;
}

// GET - Get current metrics for the authenticated user/agent
export async function GET(req: NextRequest) {
  const requestId = generateRequestId();

  try {
    // Verify access (works for both API keys and session auth)
    const access = await verifyApiAccess(req);

    if (access.type === 'error') {
      const rateLimitHeaders = access.rateLimit
        ? {
            'X-RateLimit-Limit': access.rateLimit.limit.toString(),
            'X-RateLimit-Remaining': access.rateLimit.remaining.toString(),
            'X-RateLimit-Reset': access.rateLimit.reset.toString(),
          }
        : undefined;

      return createErrorResponse(
        access.code,
        access.error,
        access.code === 'RATE_LIMITED' ? 429 : 401,
        requestId,
        undefined,
        rateLimitHeaders
      );
    }

    // Get cache stats
    const cacheStats = apiCache.getStats();

    // Get external API rate limit status
    const externalApis: Record<string, { limitPerMinute: number; currentUsage: number; remaining: number }> = {};
    for (const [service, limit] of Object.entries(API_LIMITS)) {
      const usage = rateLimiter.getUsage(service);
      externalApis[service] = {
        limitPerMinute: limit,
        currentUsage: usage?.count || 0,
        remaining: limit - (usage?.count || 0),
      };
    }

    // Build response based on access type
    const response: MetricsResponse = {
      account: {
        type: access.type,
        tier: access.tier,
        userId: access.userId,
      },
      cache: {
        hitRate: Math.round(cacheStats.hitRate * 100) / 100,
        size: cacheStats.size,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
      },
      externalApis,
      timestamp: new Date().toISOString(),
    };

    // Add rate limit info for agents
    if (access.type === 'agent') {
      response.rateLimit = {
        ...access.rateLimit,
        percentUsed: Math.round(
          ((access.rateLimit.limit - access.rateLimit.remaining) / access.rateLimit.limit) * 100
        ),
      };
    }

    const rateLimitHeaders = createRateLimitHeaders(access);

    return createSuccessResponse(response, requestId, {
      rateLimitHeaders,
    });
  } catch (error) {
    console.error('Metrics endpoint error:', error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'Internal server error',
      500,
      requestId
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}
