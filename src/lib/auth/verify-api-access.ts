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

// Hash API key using SHA-256 (Web Crypto API for edge runtime)
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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
  rateLimit: {
    limit: number;
    remaining: number;
    reset: number; // Unix timestamp
  };
  isOverage: boolean; // True if request exceeds daily limit (but overage is allowed)
  overageCount: number; // Number of requests over daily limit today
};

export type ApiAccessError = {
  type: 'error';
  code: 'UNAUTHORIZED' | 'INVALID_KEY' | 'RATE_LIMITED';
  error: string;
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: number;
  };
};

export type ApiAccess = ApiAccessHuman | ApiAccessAgent | ApiAccessError;

// Calculate midnight UTC for rate limit reset
function getResetTimestamp(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return Math.floor(tomorrow.getTime() / 1000);
}

export async function verifyApiAccess(req: NextRequest): Promise<ApiAccess> {
  // 1. Check for API key (agents)
  const apiKey =
    req.headers.get('x-api-key') || req.nextUrl.searchParams.get('api_key');

  if (apiKey) {
    const service = await getSupabaseServerWithServiceRole();

    // SECURITY: Hash the API key for secure lookup (never store or compare plain text)
    const hashedKey = await hashApiKey(apiKey);

    // Look up by hashed key only - plain text keys no longer supported
    const { data: key, error } = await service
      .from('api_keys')
      .select('id, user_id, tier, daily_limit, is_revoked')
      .eq('hashed_key', hashedKey)
      .eq('is_revoked', false)
      .single();

    if (error || !key) {
      return {
        type: 'error',
        code: 'INVALID_KEY',
        error: 'Invalid or revoked API key'
      };
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
    const resetTimestamp = getResetTimestamp();
    const tier = (key.tier as AgentTier) || 'developer';
    const tierLimits = AGENT_LIMITS[tier] || AGENT_LIMITS.developer;

    // Check if limit exceeded
    const isOverLimit = currentUsage >= key.daily_limit;
    const overageCount = Math.max(0, currentUsage - key.daily_limit + 1);

    // If over limit and overage NOT enabled, reject the request
    if (isOverLimit && !tierLimits.overageEnabled) {
      return {
        type: 'error',
        code: 'RATE_LIMITED',
        error: 'Daily API limit exceeded. Upgrade to Builder or Scale tier for overage billing.',
        rateLimit: {
          limit: key.daily_limit,
          remaining: 0,
          reset: resetTimestamp,
        }
      };
    }

    // Increment usage counter (upsert)
    const { error: usageError } = await service
      .from('api_usage')
      .upsert(
        { api_key_id: key.id, date: today, request_count: currentUsage + 1 },
        { onConflict: 'api_key_id,date' }
      );

    if (usageError) {
      // This affects metering/billing — log loudly
      console.error('[BILLING] Failed to record API usage:', usageError, {
        keyId: key.id,
        date: today,
      });
    }

    // Update last_used timestamp (informational — log but don't block)
    service
      .from('api_keys')
      .update({ last_used: new Date().toISOString() })
      .eq('id', key.id)
      .then(({ error }) => {
        if (error) console.warn('Failed to update last_used:', error);
      });

    return {
      type: 'agent',
      tier,
      userId: key.user_id,
      keyId: key.id,
      limits: tierLimits,
      rateLimit: {
        limit: key.daily_limit,
        remaining: Math.max(0, key.daily_limit - currentUsage - 1),
        reset: resetTimestamp,
      },
      isOverage: isOverLimit,
      overageCount: isOverLimit ? overageCount : 0,
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

// Helper to create rate limit headers
export function createRateLimitHeaders(access: ApiAccess): Record<string, string> {
  if (access.type === 'agent') {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': access.rateLimit.limit.toString(),
      'X-RateLimit-Remaining': access.rateLimit.remaining.toString(),
      'X-RateLimit-Reset': access.rateLimit.reset.toString(),
    };

    // Add overage headers if applicable
    if (access.isOverage) {
      headers['X-RateLimit-Overage'] = 'true';
      headers['X-RateLimit-Overage-Count'] = access.overageCount.toString();
      headers['X-RateLimit-Overage-Rate'] = `$${access.limits.overagePricePerHundred}/1000`;
    }

    return headers;
  }
  if (access.type === 'error' && access.rateLimit) {
    return {
      'X-RateLimit-Limit': access.rateLimit.limit.toString(),
      'X-RateLimit-Remaining': access.rateLimit.remaining.toString(),
      'X-RateLimit-Reset': access.rateLimit.reset.toString(),
    };
  }
  return {};
}
