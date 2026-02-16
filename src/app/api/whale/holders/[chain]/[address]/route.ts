import { NextRequest, NextResponse } from 'next/server';
import { ChainId, CHAINS } from '@/types/chain';
import { TIER_LIMITS, AGENT_LIMITS } from '@/types/subscription';
import { getTopHolders } from '@/lib/api/whale';
import { verifyApiAccess } from '@/lib/auth/verify-api-access';

interface RouteParams {
  params: Promise<{
    chain: string;
    address: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { chain, address } = await params;

  // Validate chain
  if (!(chain in CHAINS)) {
    return NextResponse.json(
      { success: false, error: 'Invalid chain' },
      { status: 400 }
    );
  }

  const chainId = chain as ChainId;

  // Verify access (supports both human sessions and API keys)
  const access = await verifyApiAccess(request);

  if (access.type === 'error') {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: 401 }
    );
  }

  // Determine limit based on access type
  let limit = TIER_LIMITS.free.topHolders;

  if (access.type === 'human' && access.tier === 'pro') {
    limit = TIER_LIMITS.pro.topHolders;
  } else if (access.type === 'agent') {
    // Agents get PRO-level access
    limit = TIER_LIMITS.pro.topHolders;
  }

  try {
    const holders = await getTopHolders(chainId, address, limit);

    return NextResponse.json({
      success: true,
      holders,
      limit,
      total: holders.length,
    });
  } catch (error) {
    console.error('Error fetching holders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch holders' },
      { status: 500 }
    );
  }
}
