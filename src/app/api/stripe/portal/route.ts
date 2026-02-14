import { NextResponse } from 'next/server';
import { getSupabaseServer, getSupabaseServerWithServiceRole } from '@/lib/db/supabase-server';
import { getUserSubscription } from '@/lib/db/subscription';
import { getStripe, STRIPE_CONFIG } from '@/lib/stripe';

export async function POST() {
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

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { success: false, error: 'No subscription found' },
        { status: 404 }
      );
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: STRIPE_CONFIG.portalReturnUrl,
    });

    return NextResponse.json({
      success: true,
      url: session.url,
    });
  } catch (error) {
    console.error('Portal error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
