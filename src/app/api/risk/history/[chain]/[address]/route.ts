import { NextRequest, NextResponse } from 'next/server';
import { ChainId, CHAINS } from '@/types/chain';
import { getRiskHistory } from '@/lib/db/supabase';
import { getSupabaseServer, getSupabaseServerWithServiceRole } from '@/lib/db/supabase-server';
import { getUserSubscription } from '@/lib/db/subscription';
import { TIER_LIMITS } from '@/types/subscription';
import {
  generateRequestId,
  getCorsHeaders,
  createErrorResponse,
  validateAddress,
  API_VERSION,
} from '@/lib/api/utils';

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

  // Check PRO subscription - historical data is PRO only
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(
      'UNAUTHORIZED',
      'Authentication required for historical data',
      401,
      requestId
    );
  }

  const serviceSupabase = await getSupabaseServerWithServiceRole();
  const subscription = await getUserSubscription(serviceSupabase, user.id);
  const tier = subscription?.tier === 'pro' && subscription?.status === 'active' ? 'pro' : 'free';
  const limits = TIER_LIMITS[tier];

  if (!limits.hasHistoricalData) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PRO_REQUIRED',
          message: 'Historical risk data requires a PRO subscription',
        },
      },
      {
        status: 403,
        headers: {
          ...getCorsHeaders(),
          'X-Request-ID': requestId,
          'X-API-Version': API_VERSION,
        },
      }
    );
  }

  // Get days parameter (default 30, max 90)
  const searchParams = request.nextUrl.searchParams;
  let days = parseInt(searchParams.get('days') || '30', 10);
  if (isNaN(days) || days < 1) days = 30;
  if (days > 90) days = 90;

  try {
    const history = await getRiskHistory(chainId, address, days);

    return NextResponse.json(
      {
        success: true,
        data: {
          chainId,
          address,
          days,
          history,
        },
      },
      {
        headers: {
          ...getCorsHeaders(),
          'X-Request-ID': requestId,
          'X-API-Version': API_VERSION,
          'Cache-Control': 'private, max-age=300', // 5 minute cache
        },
      }
    );
  } catch (error) {
    console.error('Risk history fetch error:', error);
    return createErrorResponse(
      'INTERNAL_ERROR',
      'Failed to fetch risk history',
      500,
      requestId
    );
  }
}
