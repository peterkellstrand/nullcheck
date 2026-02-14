import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/stripe';
import { upsertSubscription, downgradeToFree } from '@/lib/db/subscription';
import type { SubscriptionStatus } from '@/types/subscription';
import Stripe from 'stripe';

// Create a service role client for webhook (no cookies needed)
function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'incomplete':
    case 'incomplete_expired':
    case 'unpaid':
    case 'paused':
    default:
      return 'canceled';
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const userId = subscription.metadata.supabase_user_id;

        if (!userId) {
          // Try to get user ID from customer metadata
          const customer = await stripe.customers.retrieve(customerId);
          if (customer.deleted) {
            console.error('Customer deleted:', customerId);
            break;
          }
          const userIdFromCustomer = customer.metadata.supabase_user_id;
          if (!userIdFromCustomer) {
            console.error('No user ID found for subscription:', subscription.id);
            break;
          }
        }

        const finalUserId = userId || (await (async () => {
          const customer = await stripe.customers.retrieve(customerId);
          return !customer.deleted ? customer.metadata.supabase_user_id : null;
        })());

        if (!finalUserId) {
          console.error('Could not determine user ID for subscription');
          break;
        }

        // Get period dates from the first subscription item
        const firstItem = subscription.items.data[0];
        const currentPeriodStart = firstItem?.current_period_start ?? Math.floor(Date.now() / 1000);
        const currentPeriodEnd = firstItem?.current_period_end ?? Math.floor(Date.now() / 1000);

        await upsertSubscription(supabase, {
          userId: finalUserId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: firstItem?.price.id || '',
          tier: 'pro',
          status: mapStripeStatus(subscription.status),
          currentPeriodStart: new Date(currentPeriodStart * 1000),
          currentPeriodEnd: new Date(currentPeriodEnd * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await downgradeToFree(supabase, subscription.id);
        break;
      }

      default:
        // Unhandled event type
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
