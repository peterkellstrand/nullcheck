import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer, getSupabaseServerWithServiceRole } from '@/lib/db/supabase-server';
import { getUserSubscription, createOrGetStripeCustomerId } from '@/lib/db/subscription';
import { getStripe, STRIPE_CONFIG, getPriceId, isAgentTier } from '@/lib/stripe';
import type { PriceType } from '@/types/subscription';

const VALID_PRICE_TYPES = ['monthly', 'yearly', 'developer', 'professional', 'business'];

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

    if (!priceType || !VALID_PRICE_TYPES.includes(priceType)) {
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

    // Build line items
    const lineItems: Array<{ price: string; quantity?: number }> = [
      {
        price: getPriceId(priceType),
        quantity: 1,
      },
    ];

    // For Professional and Business agent tiers, add metered overage price
    if (priceType === 'professional' && STRIPE_CONFIG.overagePrices.professional) {
      lineItems.push({
        price: STRIPE_CONFIG.overagePrices.professional,
      });
    } else if (priceType === 'business' && STRIPE_CONFIG.overagePrices.business) {
      lineItems.push({
        price: STRIPE_CONFIG.overagePrices.business,
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: STRIPE_CONFIG.successUrl,
      cancel_url: STRIPE_CONFIG.cancelUrl,
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          subscription_type: isAgentTier(priceType) ? 'agent' : 'human',
          tier: priceType,
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
