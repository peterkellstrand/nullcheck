import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer, getSupabaseServerWithServiceRole } from '@/lib/db/supabase-server';
import { getUserSubscription } from '@/lib/db/subscription';
import { TIER_LIMITS, AGENT_LIMITS, type SubscriptionTier } from '@/types/subscription';
import { verifyApiAccess } from '@/lib/auth/verify-api-access';

export async function GET(req: NextRequest) {
  // Support both API key and session auth
  const access = await verifyApiAccess(req);

  if (access.type === 'error') {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: 401 }
    );
  }

  // If agent access, return agent info
  if (access.type === 'agent') {
    return NextResponse.json({
      success: true,
      accessType: 'agent',
      tier: access.tier,
      limits: access.limits,
    });
  }

  // Human access - get full subscription details
  if (access.userId === 'anonymous') {
    return NextResponse.json({
      success: true,
      accessType: 'human',
      tier: 'free',
      limits: TIER_LIMITS.free,
      subscription: null,
    });
  }

  try {
    const serviceSupabase = await getSupabaseServerWithServiceRole();
    const subscription = await getUserSubscription(serviceSupabase, access.userId);

    // Count active API keys for PRO users
    let apiKeyCount = 0;
    if (access.tier === 'pro') {
      const { count } = await serviceSupabase
        .from('api_keys')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', access.userId)
        .eq('is_revoked', false);
      apiKeyCount = count || 0;
    }

    return NextResponse.json({
      success: true,
      accessType: 'human',
      subscription: subscription || null,
      tier: access.tier,
      limits: access.limits,
      apiKeyCount,
    });
  } catch (error) {
    console.error('Subscription fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}
