import { NextRequest, NextResponse } from 'next/server';
import { ChainId, CHAINS } from '@/types/chain';
import { TIER_LIMITS } from '@/types/subscription';
import { getTopHolders } from '@/lib/api/whale';
import { getSupabaseServer, getSupabaseServerWithServiceRole } from '@/lib/db/supabase-server';
import { getUserSubscription } from '@/lib/db/subscription';

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

  // Determine limit based on subscription
  let limit = TIER_LIMITS.free.topHolders;

  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const serviceSupabase = await getSupabaseServerWithServiceRole();
      const subscription = await getUserSubscription(serviceSupabase, user.id);

      if (subscription?.tier === 'pro' && subscription?.status === 'active') {
        limit = TIER_LIMITS.pro.topHolders;
      }
    }
  } catch {
    // Use free limit if auth check fails
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
