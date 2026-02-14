import type { SupabaseClient } from '@supabase/supabase-js';
import type { SubscriptionTier, SubscriptionStatus, UserSubscription } from '@/types/subscription';

interface DBSubscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

function mapDBtoUserSubscription(row: DBSubscription): UserSubscription {
  return {
    id: row.id,
    userId: row.user_id,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripePriceId: row.stripe_price_id,
    tier: row.tier,
    status: row.status,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getUserSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<UserSubscription | null> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No subscription found - user is on free tier
      return null;
    }
    throw error;
  }

  return mapDBtoUserSubscription(data as DBSubscription);
}

export async function getSubscriptionByStripeCustomerId(
  supabase: SupabaseClient,
  stripeCustomerId: string
): Promise<UserSubscription | null> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('stripe_customer_id', stripeCustomerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return mapDBtoUserSubscription(data as DBSubscription);
}

export async function upsertSubscription(
  supabase: SupabaseClient,
  data: {
    userId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    stripePriceId: string;
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
  }
): Promise<void> {
  const { error } = await supabase.from('user_subscriptions').upsert(
    {
      user_id: data.userId,
      stripe_customer_id: data.stripeCustomerId,
      stripe_subscription_id: data.stripeSubscriptionId,
      stripe_price_id: data.stripePriceId,
      tier: data.tier,
      status: data.status,
      current_period_start: data.currentPeriodStart.toISOString(),
      current_period_end: data.currentPeriodEnd.toISOString(),
      cancel_at_period_end: data.cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id',
    }
  );

  if (error) throw error;
}

export async function downgradeToFree(
  supabase: SupabaseClient,
  stripeSubscriptionId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      tier: 'free',
      status: 'canceled',
      stripe_subscription_id: null,
      stripe_price_id: null,
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', stripeSubscriptionId);

  if (error) throw error;
}

export async function createOrGetStripeCustomerId(
  supabase: SupabaseClient,
  userId: string,
  stripeCustomerId: string
): Promise<void> {
  const { error } = await supabase.from('user_subscriptions').upsert(
    {
      user_id: userId,
      stripe_customer_id: stripeCustomerId,
      tier: 'free',
      status: 'active',
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id',
      ignoreDuplicates: false,
    }
  );

  if (error) throw error;
}
