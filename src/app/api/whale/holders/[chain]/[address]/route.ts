import { NextRequest, NextResponse } from 'next/server';
import { ChainId, CHAINS } from '@/types/chain';
import { TIER_LIMITS } from '@/types/subscription';
import { getTopHolders } from '@/lib/api/whale';
import { verifyApiAccess, createRateLimitHeaders } from '@/lib/auth/verify-api-access';
import {
  generateRequestId,
  generateETag,
  getCorsHeaders,
  createErrorResponse,
  validateAddress,
  handleCorsOptions,
  API_VERSION,
} from '@/lib/api/utils';

export const runtime = 'edge';

export const OPTIONS = handleCorsOptions;

interface RouteParams {
  params: Promise<{
    chain: string;
    address: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const requestId = request.headers.get('X-Request-ID') || generateRequestId();
  const { chain, address } = await params;

  // Verify access (supports both human sessions and API keys)
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
  if (!(chain in CHAINS)) {
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

  // Determine limit based on access type
  let limit = TIER_LIMITS.free.topHolders;
  if (access.type === 'human' && access.tier === 'pro') {
    limit = TIER_LIMITS.pro.topHolders;
  } else if (access.type === 'agent') {
    limit = TIER_LIMITS.pro.topHolders;
  }

  try {
    const holders = await getTopHolders(chainId, address, limit);
    const etag = generateETag(holders);

    // Check If-None-Match for conditional GET
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ...getCorsHeaders(),
          ...rateLimitHeaders,
          'X-Request-ID': requestId,
          'X-API-Version': API_VERSION,
          ETag: etag,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          holders,
          limit,
          total: holders.length,
        },
      },
      {
        headers: {
          ...getCorsHeaders(),
          ...rateLimitHeaders,
          'X-Request-ID': requestId,
          'X-API-Version': API_VERSION,
          'Cache-Control': 'public, max-age=60',
          ETag: etag,
        },
      }
    );
  } catch (error) {
    console.error('Error fetching holders:', error);
    return createErrorResponse(
      'INTERNAL_ERROR',
      'Failed to fetch holders',
      500,
      requestId,
      undefined,
      rateLimitHeaders
    );
  }
}
