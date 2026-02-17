import { createClient } from '@supabase/supabase-js';
import { AgentTier, AGENT_LIMITS } from '@/types/subscription';

// Service role client for billing operations
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Daily usage record for an API key
 */
export interface DailyUsage {
  date: string;
  requestCount: number;
  overageCount: number;
}

/**
 * Billing period usage summary
 */
export interface BillingPeriodUsage {
  apiKeyId: string;
  keyName: string;
  tier: AgentTier;
  dailyLimit: number;
  periodStart: string;
  periodEnd: string;
  totalRequests: number;
  includedRequests: number;
  overageRequests: number;
  overageCharge: number;
  dailyUsage: DailyUsage[];
}

/**
 * Get current billing period dates (calendar month)
 */
export function getCurrentBillingPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

/**
 * Calculate days in the current billing period
 */
export function getDaysInBillingPeriod(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

/**
 * Get usage for a specific API key for the current billing period
 */
export async function getKeyBillingUsage(apiKeyId: string): Promise<BillingPeriodUsage | null> {
  const supabase = getServiceClient();
  const { start, end } = getCurrentBillingPeriod();

  // Get API key details
  const { data: keyData, error: keyError } = await supabase
    .from('api_keys')
    .select('id, name, tier, daily_limit, user_id')
    .eq('id', apiKeyId)
    .single();

  if (keyError || !keyData) {
    return null;
  }

  const tier = keyData.tier as AgentTier;
  const limits = AGENT_LIMITS[tier];
  const daysInPeriod = getDaysInBillingPeriod();

  // Get daily usage for the billing period
  const { data: usageData, error: usageError } = await supabase
    .from('api_usage')
    .select('date, request_count')
    .eq('api_key_id', apiKeyId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });

  if (usageError) {
    console.error('Failed to fetch usage data:', usageError);
    return null;
  }

  // Calculate totals and overages
  let totalRequests = 0;
  let overageRequests = 0;
  const dailyUsage: DailyUsage[] = [];

  for (const row of usageData || []) {
    const dayUsage = row.request_count;
    const dayOverage = Math.max(0, dayUsage - keyData.daily_limit);

    totalRequests += dayUsage;
    overageRequests += dayOverage;

    dailyUsage.push({
      date: row.date,
      requestCount: dayUsage,
      overageCount: dayOverage,
    });
  }

  // Calculate included requests (limited by daily limit * days so far)
  const daysSoFar = dailyUsage.length;
  const maxIncludedRequests = keyData.daily_limit * daysSoFar;
  const includedRequests = Math.min(totalRequests, maxIncludedRequests);

  // Calculate overage charge
  const overageCharge = limits.overageEnabled
    ? (overageRequests / 1000) * limits.overagePricePerThousand
    : 0;

  return {
    apiKeyId,
    keyName: keyData.name,
    tier,
    dailyLimit: keyData.daily_limit,
    periodStart: start,
    periodEnd: end,
    totalRequests,
    includedRequests,
    overageRequests,
    overageCharge: Math.round(overageCharge * 100) / 100, // Round to cents
    dailyUsage,
  };
}

/**
 * Get billing usage for all API keys owned by a user
 */
export async function getUserBillingUsage(userId: string): Promise<{
  period: { start: string; end: string };
  keys: BillingPeriodUsage[];
  totals: {
    totalRequests: number;
    overageRequests: number;
    overageCharge: number;
  };
}> {
  const supabase = getServiceClient();
  const { start, end } = getCurrentBillingPeriod();

  // Get all user's API keys
  const { data: keys, error: keysError } = await supabase
    .from('api_keys')
    .select('id')
    .eq('user_id', userId)
    .eq('is_revoked', false);

  if (keysError || !keys) {
    return {
      period: { start, end },
      keys: [],
      totals: { totalRequests: 0, overageRequests: 0, overageCharge: 0 },
    };
  }

  // Get usage for each key
  const keyUsages: BillingPeriodUsage[] = [];
  let totalRequests = 0;
  let overageRequests = 0;
  let overageCharge = 0;

  for (const key of keys) {
    const usage = await getKeyBillingUsage(key.id);
    if (usage) {
      keyUsages.push(usage);
      totalRequests += usage.totalRequests;
      overageRequests += usage.overageRequests;
      overageCharge += usage.overageCharge;
    }
  }

  return {
    period: { start, end },
    keys: keyUsages,
    totals: {
      totalRequests,
      overageRequests,
      overageCharge: Math.round(overageCharge * 100) / 100,
    },
  };
}

/**
 * Record overage usage (for tracking purposes)
 * This is called when a request exceeds the daily limit but overage is enabled
 */
export async function recordOverageRequest(
  apiKeyId: string,
  count: number = 1
): Promise<void> {
  // Usage is already tracked in api_usage table by verify-api-access
  // This function can be used for additional overage-specific tracking if needed
  console.log(`Overage recorded: ${count} requests for key ${apiKeyId}`);
}

/**
 * Report usage to Stripe for metered billing (if configured)
 * This would be called by a daily cron job
 */
export async function reportUsageToStripe(
  stripeSubscriptionItemId: string,
  quantity: number,
  timestamp?: number
): Promise<boolean> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    console.warn('Stripe not configured, skipping usage report');
    return false;
  }

  try {
    // Report metered usage to Stripe
    const response = await fetch('https://api.stripe.com/v1/subscription_items/' + stripeSubscriptionItemId + '/usage_records', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        quantity: quantity.toString(),
        timestamp: (timestamp || Math.floor(Date.now() / 1000)).toString(),
        action: 'increment',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Stripe usage report failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Stripe usage report error:', error);
    return false;
  }
}

/**
 * Check if an API key has exceeded its daily limit
 * Returns overage info if limit exceeded but overage is enabled
 */
export async function checkDailyLimitStatus(
  apiKeyId: string,
  tier: AgentTier,
  currentUsage: number,
  dailyLimit: number
): Promise<{
  exceeded: boolean;
  overageAllowed: boolean;
  overageCount: number;
  estimatedCharge: number;
}> {
  const limits = AGENT_LIMITS[tier];
  const exceeded = currentUsage >= dailyLimit;
  const overageCount = Math.max(0, currentUsage - dailyLimit);
  const estimatedCharge = limits.overageEnabled
    ? (overageCount / 1000) * limits.overagePricePerThousand
    : 0;

  return {
    exceeded,
    overageAllowed: limits.overageEnabled,
    overageCount,
    estimatedCharge: Math.round(estimatedCharge * 100) / 100,
  };
}
