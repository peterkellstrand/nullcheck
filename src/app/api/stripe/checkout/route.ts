import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer, getSupabaseServerWithServiceRole } from '@/lib/db/supabase-server';
import { getUserSubscription, createOrGetStripeCustomerId } from '@/lib/db/subscription';
import { getStripe, STRIPE_CONFIG, getPriceId } from '@/lib/stripe';
import type { PriceType } from '@/types/subscription';

export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const { priceType } = body as { priceType: PriceType };

    if (!priceType || !['monthly', 'yearly'].includes(priceType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid price type' },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const serviceSupabase = await getSupabaseServerWithServiceRole();

    // Check if user already has a subscription record with Stripe customer ID
    const existingSub = await getUserSubscription(serviceSupabase, user.id);
    let stripeCustomerId = existingSub?.stripeCustomerId;

    // Create or retrieve Stripe customer
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      stripeCustomerId = customer.id;

      // Store the customer ID in our database
      await createOrGetStripeCustomerId(serviceSupabase, user.id, stripeCustomerId);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: getPriceId(priceType),
          quantity: 1,
        },
      ],
      success_url: STRIPE_CONFIG.successUrl,
      cancel_url: STRIPE_CONFIG.cancelUrl,
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      url: session.url,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
