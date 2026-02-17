import { NextRequest, NextResponse } from 'next/server';
import { ChainId, CHAINS } from '@/types/chain';
import { analyzeToken } from '@/lib/risk/analyzer';
import { getRiskScore, upsertRiskScore } from '@/lib/db/supabase';
import { verifyApiAccess, createRateLimitHeaders } from '@/lib/auth/verify-api-access';
import {
  generateRequestId,
  generateETag,
  getCorsHeaders,
  createErrorResponse,
  validateAddress,
  API_VERSION,
  CACHE_MAX_AGE,
} from '@/lib/api/utils';
import { triggerRiskWebhooks, shouldTriggerRiskWebhook } from '@/lib/webhooks/triggers';

export const runtime = 'edge';

interface RouteParams {
  params: Promise<{
    chain: string;
    address: string;
  }>;
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const requestId = request.headers.get('X-Request-ID') || generateRequestId();
  const { chain, address } = await params;

  // Validate chain
  if (!CHAINS[chain as ChainId]) {
    return createErrorResponse(
      'INVALID_CHAIN',
      `Chain '${chain}' is not supported. Valid chains: ${Object.keys(CHAINS).join(', ')}`,
      400,
      requestId
    );
  }

  const chainId = chain as ChainId;

  // Validate address format
  if (!validateAddress(chainId, address)) {
    return createErrorResponse(
      'INVALID_ADDRESS',
      `Invalid ${chainId} address format`,
      400,
      requestId
    );
  }

  try {
    // Check cache first
    const cached = await getRiskScore(chainId, address).catch(() => null);

    if (!cached) {
      return createErrorResponse(
        'NOT_FOUND',
        'Risk score not found. Use POST to analyze.',
        404,
        requestId,
        { chain: chainId, address }
      );
    }

    const etag = generateETag(cached);

    // Check If-None-Match for conditional GET
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ...getCorsHeaders(),
          'X-Request-ID': requestId,
          'X-API-Version': API_VERSION,
          ETag: etag,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: cached,
        cached: true,
      },
      {
        headers: {
          ...getCorsHeaders(),
          'X-Request-ID': requestId,
          'X-API-Version': API_VERSION,
          'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
          ETag: etag,
        },
      }
    );
  } catch (error) {
    console.error('Risk fetch error:', error);
    return createErrorResponse(
      'INTERNAL_ERROR',
      'Failed to fetch risk score',
      500,
      requestId
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const requestId = request.headers.get('X-Request-ID') || generateRequestId();
  const idempotencyKey = request.headers.get('X-Idempotency-Key');
  const { chain, address } = await params;

  // Verify API access (handles both human sessions and API keys)
  const access = await verifyApiAccess(request);
  const rateLimitHeaders = createRateLimitHeaders(access);

  if (access.type === 'error') {
    return createErrorResponse(
      access.code,
      access.error,
      access.code === 'RATE_LIMITED' ? 429 : 401,
      requestId,
      undefined,
      rateLimitHeaders
    );
  }

  // Validate chain
  if (!CHAINS[chain as ChainId]) {
    return createErrorResponse(
      'INVALID_CHAIN',
      `Chain '${chain}' is not supported. Valid chains: ${Object.keys(CHAINS).join(', ')}`,
      400,
      requestId,
      undefined,
      rateLimitHeaders
    );
  }

  const chainId = chain as ChainId;

  // Validate address format
  if (!validateAddress(chainId, address)) {
    return createErrorResponse(
      'INVALID_ADDRESS',
      `Invalid ${chainId} address format`,
      400,
      requestId,
      undefined,
      rateLimitHeaders
    );
  }

  try {
    // If idempotency key provided, check for existing result
    if (idempotencyKey) {
      const cached = await getRiskScore(chainId, address).catch(() => null);
      if (cached) {
        const etag = generateETag(cached);
        return NextResponse.json(
          {
            success: true,
            data: cached,
            cached: true,
            idempotent: true,
          },
          {
            headers: {
              ...getCorsHeaders(),
              ...rateLimitHeaders,
              'X-Request-ID': requestId,
              'X-API-Version': API_VERSION,
              ETag: etag,
            },
          }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    const liquidity = body.liquidity || 0;

    // Perform fresh analysis
    const riskScore = await analyzeToken({
      tokenAddress: address,
      chainId,
      liquidity,
    });

    // Cache the result (ignore errors)
    upsertRiskScore(riskScore).catch(console.error);

    // Trigger webhooks for high/critical risk (fire-and-forget, don't block response)
    if (shouldTriggerRiskWebhook(riskScore)) {
      triggerRiskWebhooks(
        address,
        chainId,
        body.symbol || 'UNKNOWN',
        body.name || 'Unknown Token',
        riskScore
      ).catch((err) => console.error('Webhook trigger error:', err));
    }

    const etag = generateETag(riskScore);

    return NextResponse.json(
      {
        success: true,
        data: riskScore,
        cached: false,
      },
      {
        status: 201,
        headers: {
          ...getCorsHeaders(),
          ...rateLimitHeaders,
          'X-Request-ID': requestId,
          'X-API-Version': API_VERSION,
          ETag: etag,
        },
      }
    );
  } catch (error) {
    console.error('Risk analysis error:', error);
    return createErrorResponse(
      'ANALYSIS_FAILED',
      'Failed to analyze token',
      500,
      requestId,
      undefined,
      rateLimitHeaders
    );
  }
}
