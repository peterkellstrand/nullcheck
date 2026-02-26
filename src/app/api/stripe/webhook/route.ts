import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { getStripe, STRIPE_CONFIG } from '@/lib/stripe';
import { upsertSubscription, downgradeToFree } from '@/lib/db/subscription';
import { sendApiKeyEmail } from '@/lib/email';
import type { SubscriptionStatus, AgentTier } from '@/types/subscription';
import Stripe from 'stripe';

// Hash API key using SHA-256
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Determine if a price ID is for an agent tier
function getAgentTierFromPriceId(priceId: string): AgentTier | null {
  if (priceId === STRIPE_CONFIG.prices.developer) return 'developer';
  if (priceId === STRIPE_CONFIG.prices.professional) return 'professional';
  if (priceId === STRIPE_CONFIG.prices.business) return 'business';
  return null;
}

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
        const subscriptionType = subscription.metadata.subscription_type; // 'agent' or 'human'
        const tierFromMetadata = subscription.metadata.tier;

        // Retrieve customer once (used for user ID lookup and email)
        let customer: Stripe.Customer | Stripe.DeletedCustomer | null = null;

        if (!userId) {
          // Try to get user ID from customer metadata
          customer = await stripe.customers.retrieve(customerId);
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

        const finalUserId = userId || (customer && !customer.deleted ? customer.metadata.supabase_user_id : null);

        if (!finalUserId) {
          console.error('Could not determine user ID for subscription');
          break;
        }

        // Get period dates from the first subscription item
        const firstItem = subscription.items.data[0];
        const currentPeriodStart = firstItem?.current_period_start ?? Math.floor(Date.now() / 1000);
        const currentPeriodEnd = firstItem?.current_period_end ?? Math.floor(Date.now() / 1000);

        // Check if this is an agent tier subscription
        const agentTier = getAgentTierFromPriceId(firstItem?.price.id || '') ||
                          (tierFromMetadata as AgentTier | undefined);

        if (subscriptionType === 'agent' || agentTier) {
          // Agent subscription - create or update API key

          // Check if user already has a key for this subscription
          const { data: existingKey } = await supabase
            .from('api_keys')
            .select('id')
            .eq('stripe_subscription_id', subscription.id)
            .single();

          if (!existingKey && event.type === 'customer.subscription.created') {
            // Create new API key for this subscription
            const apiKey = `nk_${nanoid(32)}`;
            const hashedKey = await hashApiKey(apiKey);
            const keyPrefix = apiKey.substring(0, 12) + '...';

            const { error: keyError } = await supabase
              .from('api_keys')
              .insert({
                user_id: finalUserId,
                hashed_key: hashedKey,
                key_prefix: keyPrefix,
                name: `${agentTier || 'API'} Key`,
                tier: agentTier || 'developer',
                stripe_subscription_id: subscription.id,
              });

            if (keyError) {
              console.error('Failed to create API key:', keyError);
            } else {
              // Send API key email - wrap in try/catch so email failure doesn't cause webhook retry
              try {
                // Retrieve customer if not already fetched
                if (!customer) {
                  customer = await stripe.customers.retrieve(customerId);
                }
                if (!customer.deleted && customer.email) {
                  await sendApiKeyEmail(
                    customer.email,
                    apiKey,
                    agentTier || 'developer'
                  );
                }
              } catch (emailError) {
                // Log but don't throw — key was created successfully.
                // A failed email must not cause Stripe to retry and skip the email again.
                console.error('Failed to send API key email:', emailError);
              }
            }
          } else if (existingKey) {
            // Update existing key's tier if subscription changed
            await supabase
              .from('api_keys')
              .update({ tier: agentTier || 'developer' })
              .eq('stripe_subscription_id', subscription.id);
          }
        } else {
          // Human subscription (PRO)
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
        }
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
