import { NextResponse } from 'next/server';
import { getSupabaseServer, getSupabaseServerWithServiceRole } from '@/lib/db/supabase-server';
import { getUserSubscription } from '@/lib/db/subscription';
import { TIER_LIMITS, type SubscriptionTier } from '@/types/subscription';

export async function GET() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const serviceSupabase = await getSupabaseServerWithServiceRole();
    const subscription = await getUserSubscription(serviceSupabase, user.id);

    // Determine effective tier
    let tier: SubscriptionTier = 'free';
    if (subscription && subscription.tier === 'pro' && subscription.status === 'active') {
      tier = 'pro';
    }

    return NextResponse.json({
      success: true,
      subscription: subscription || null,
      tier,
      limits: TIER_LIMITS[tier],
    });
  } catch (error) {
    console.error('Subscription fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}
