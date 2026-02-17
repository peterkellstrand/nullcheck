/**
 * Billing job handlers for usage reporting
 */

import { createClient } from '@supabase/supabase-js';
import { AGENT_LIMITS, AgentTier } from '@/types/subscription';

// Service role client
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
 * Report daily overage usage to Stripe for metered billing
 *
 * This job runs at midnight UTC and reports the previous day's overage
 * for all API keys that have overage enabled.
 */
export async function reportDailyUsageToStripe(): Promise<Record<string, unknown>> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    return {
      reported: false,
      note: 'Stripe not configured',
    };
  }

  const supabase = getServiceClient();

  // Get yesterday's date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Get all API keys with their usage for yesterday
  const { data: usageData, error: usageError } = await supabase
    .from('api_usage')
    .select(`
      api_key_id,
      request_count,
      api_keys!inner (
        id,
        user_id,
        tier,
        daily_limit
      )
    `)
    .eq('date', yesterdayStr);

  if (usageError) {
    throw new Error(`Failed to fetch usage data: ${usageError.message}`);
  }

  if (!usageData || usageData.length === 0) {
    return {
      reported: true,
      date: yesterdayStr,
      keysProcessed: 0,
      totalOverage: 0,
    };
  }

  let keysProcessed = 0;
  let totalOverage = 0;
  let keysReported = 0;
  const errors: string[] = [];

  for (const usage of usageData) {
    const apiKey = usage.api_keys as unknown as {
      id: string;
      user_id: string;
      tier: string;
      daily_limit: number;
    };

    if (!apiKey) continue;

    const tier = apiKey.tier as AgentTier;
    const limits = AGENT_LIMITS[tier];

    // Skip if overage not enabled for this tier
    if (!limits?.overageEnabled) continue;

    // Calculate overage
    const overageCount = Math.max(0, usage.request_count - apiKey.daily_limit);

    if (overageCount === 0) continue;

    keysProcessed++;
    totalOverage += overageCount;

    // Get user's Stripe subscription to find the metered subscription item
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', apiKey.user_id)
      .single();

    if (!subscription?.stripe_subscription_id) {
      // User doesn't have a Stripe subscription, skip
      continue;
    }

    // In a full implementation, you would:
    // 1. Look up the metered subscription item ID for this subscription
    // 2. Report the usage via Stripe API
    //
    // For now, we'll just log the overage
    console.log(
      `[billing] Overage for key ${apiKey.id}: ${overageCount} requests ` +
        `($${((overageCount / 1000) * limits.overagePricePerThousand).toFixed(2)})`
    );

    // TODO: Implement actual Stripe usage reporting
    // This requires storing the metered subscription item ID when creating the subscription
    // await reportUsageToStripe(subscriptionItemId, overageCount);

    keysReported++;
  }

  return {
    reported: true,
    date: yesterdayStr,
    keysProcessed,
    keysReported,
    totalOverage,
    note: 'Stripe metered billing requires subscription item IDs to be stored',
  };
}

/**
 * Generate monthly billing summary for all users
 * This could be used to send billing emails or create invoices
 */
export async function generateMonthlySummary(): Promise<Record<string, unknown>> {
  const supabase = getServiceClient();

  // Get the previous month
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const startDate = lastMonth.toISOString().split('T')[0];
  const endDate = lastMonthEnd.toISOString().split('T')[0];

  // Get all usage for the month, grouped by user
  const { data: usageData, error } = await supabase
    .from('api_usage')
    .select(`
      api_key_id,
      date,
      request_count,
      api_keys!inner (
        id,
        user_id,
        tier,
        daily_limit
      )
    `)
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) {
    throw new Error(`Failed to fetch usage: ${error.message}`);
  }

  // Aggregate by user
  const userSummaries = new Map<
    string,
    {
      userId: string;
      totalRequests: number;
      overageRequests: number;
      overageCharge: number;
      keys: Set<string>;
    }
  >();

  for (const usage of usageData || []) {
    const apiKey = usage.api_keys as unknown as {
      id: string;
      user_id: string;
      tier: string;
      daily_limit: number;
    };

    if (!apiKey) continue;

    const tier = apiKey.tier as AgentTier;
    const limits = AGENT_LIMITS[tier];

    let summary = userSummaries.get(apiKey.user_id);
    if (!summary) {
      summary = {
        userId: apiKey.user_id,
        totalRequests: 0,
        overageRequests: 0,
        overageCharge: 0,
        keys: new Set(),
      };
      userSummaries.set(apiKey.user_id, summary);
    }

    summary.totalRequests += usage.request_count;
    summary.keys.add(apiKey.id);

    // Calculate daily overage
    const dailyOverage = Math.max(0, usage.request_count - apiKey.daily_limit);
    summary.overageRequests += dailyOverage;

    if (limits?.overageEnabled && dailyOverage > 0) {
      summary.overageCharge += (dailyOverage / 1000) * limits.overagePricePerThousand;
    }
  }

  // Convert to array and round charges
  const summaries = Array.from(userSummaries.values()).map((s) => ({
    ...s,
    keys: s.keys.size,
    overageCharge: Math.round(s.overageCharge * 100) / 100,
  }));

  return {
    period: { start: startDate, end: endDate },
    usersWithUsage: summaries.length,
    totalRequests: summaries.reduce((sum, s) => sum + s.totalRequests, 0),
    totalOverage: summaries.reduce((sum, s) => sum + s.overageRequests, 0),
    totalCharges: Math.round(summaries.reduce((sum, s) => sum + s.overageCharge, 0) * 100) / 100,
  };
}
