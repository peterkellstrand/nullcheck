import { NextRequest } from 'next/server';
import { getSupabaseServer, getSupabaseServerWithServiceRole } from '@/lib/db/supabase-server';
import { getUserSubscription } from '@/lib/db/subscription';
import {
  SubscriptionTier,
  AgentTier,
  TIER_LIMITS,
  AGENT_LIMITS,
  SubscriptionLimits,
  AgentLimits,
} from '@/types/subscription';

export type ApiAccessHuman = {
  type: 'human';
  tier: SubscriptionTier;
  userId: string;
  limits: SubscriptionLimits;
};

export type ApiAccessAgent = {
  type: 'agent';
  tier: AgentTier;
  userId: string;
  keyId: string;
  limits: AgentLimits;
};

export type ApiAccessError = {
  type: 'error';
  error: string;
};

export type ApiAccess = ApiAccessHuman | ApiAccessAgent | ApiAccessError;

export async function verifyApiAccess(req: NextRequest): Promise<ApiAccess> {
  // 1. Check for API key (agents)
  const apiKey =
    req.headers.get('x-api-key') || req.nextUrl.searchParams.get('api_key');

  if (apiKey) {
    const service = await getSupabaseServerWithServiceRole();
    const { data: key, error } = await service
      .from('api_keys')
      .select('id, user_id, tier, daily_limit, is_revoked')
      .eq('api_key', apiKey)
      .eq('is_revoked', false)
      .single();

    if (error || !key) {
      return { type: 'error', error: 'Invalid or revoked API key' };
    }

    // Check daily usage limit
    const today = new Date().toISOString().split('T')[0];
    const { data: usage } = await service
      .from('api_usage')
      .select('request_count')
      .eq('api_key_id', key.id)
      .eq('date', today)
      .single();

    const currentUsage = usage?.request_count || 0;
    if (currentUsage >= key.daily_limit) {
      return { type: 'error', error: 'Daily API limit exceeded' };
    }

    // Increment usage counter (upsert)
    await service
      .from('api_usage')
      .upsert(
        { api_key_id: key.id, date: today, request_count: currentUsage + 1 },
        { onConflict: 'api_key_id,date' }
      );

    // Update last_used timestamp
    await service
      .from('api_keys')
      .update({ last_used: new Date().toISOString() })
      .eq('id', key.id);

    const tier: AgentTier = key.tier === 'pro' ? 'agent_pro' : 'agent_basic';
    return {
      type: 'agent',
      tier,
      userId: key.user_id,
      keyId: key.id,
      limits: AGENT_LIMITS[tier],
    };
  }

  // 2. Check for human session (UI + logged-in users)
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Allow unauthenticated access for public endpoints
    return {
      type: 'human',
      tier: 'free',
      userId: 'anonymous',
      limits: TIER_LIMITS.free,
    };
  }

  const serviceSupabase = await getSupabaseServerWithServiceRole();
  const subscription = await getUserSubscription(serviceSupabase, user.id);
  const tier: SubscriptionTier =
    subscription?.tier === 'pro' && subscription?.status === 'active'
      ? 'pro'
      : 'free';

  return {
    type: 'human',
    tier,
    userId: user.id,
    limits: TIER_LIMITS[tier],
  };
}

// Helper to check if access requires authentication
export function requireAuth(access: ApiAccess): access is ApiAccessHuman | ApiAccessAgent {
  if (access.type === 'error') return false;
  if (access.type === 'human' && access.userId === 'anonymous') return false;
  return true;
}
