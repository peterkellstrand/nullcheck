import { NextRequest } from 'next/server';
import { getSupabaseServer, getSupabaseServerWithServiceRole } from '@/lib/db/supabase-server';
import {
  generateRequestId,
  getCorsHeaders,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
  ERROR_CODES,
} from '@/lib/api/utils';
import { getUserBillingUsage, getCurrentBillingPeriod } from '@/lib/billing/metering';
import { AGENT_LIMITS, AgentTier } from '@/types/subscription';

export const runtime = 'nodejs';

export const OPTIONS = handleCorsOptions;

/**
 * GET /api/billing - Get billing summary for the authenticated user
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    // Authenticate user
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return createErrorResponse(
        ERROR_CODES.UNAUTHORIZED,
        'Authentication required',
        401,
        requestId
      );
    }

    // Get user's subscription info
    const service = await getSupabaseServerWithServiceRole();
    const { data: subscription } = await service
      .from('user_subscriptions')
      .select('tier, status, current_period_start, current_period_end')
      .eq('user_id', user.id)
      .single();

    // Get billing period info
    const period = getCurrentBillingPeriod();

    // Get usage data for all API keys
    const usage = await getUserBillingUsage(user.id);

    // Calculate projected month-end charges based on current usage rate
    const now = new Date();
    const daysIntoMonth = now.getDate();
    const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedRequests = Math.round(
      (usage.totals.totalRequests / daysIntoMonth) * totalDaysInMonth
    );

    // Calculate projected overages
    let projectedOverageRequests = 0;
    let projectedOverageCharge = 0;

    for (const key of usage.keys) {
      const limits = AGENT_LIMITS[key.tier as AgentTier];
      const dailyAverage = key.totalRequests / Math.max(1, daysIntoMonth);
      const projectedKeyRequests = dailyAverage * totalDaysInMonth;
      const projectedKeyOverage = Math.max(0, projectedKeyRequests - (key.dailyLimit * totalDaysInMonth));

      projectedOverageRequests += projectedKeyOverage;
      if (limits.overageEnabled) {
        projectedOverageCharge += (projectedKeyOverage / 1000) * limits.overagePricePerThousand;
      }
    }

    // Build response
    const response = {
      period: {
        start: period.start,
        end: period.end,
        daysIntoMonth,
        totalDaysInMonth,
      },
      subscription: subscription
        ? {
            tier: subscription.tier,
            status: subscription.status,
            periodStart: subscription.current_period_start,
            periodEnd: subscription.current_period_end,
          }
        : {
            tier: 'free',
            status: 'active',
          },
      usage: {
        totalRequests: usage.totals.totalRequests,
        overageRequests: usage.totals.overageRequests,
        currentCharges: usage.totals.overageCharge,
      },
      projected: {
        totalRequests: projectedRequests,
        overageRequests: Math.round(projectedOverageRequests),
        estimatedCharges: Math.round(projectedOverageCharge * 100) / 100,
      },
      keys: usage.keys.map((key) => ({
        id: key.apiKeyId,
        name: key.keyName,
        tier: key.tier,
        dailyLimit: key.dailyLimit,
        totalRequests: key.totalRequests,
        overageRequests: key.overageRequests,
        overageCharge: key.overageCharge,
        overageEnabled: AGENT_LIMITS[key.tier as AgentTier].overageEnabled,
        overageRate: AGENT_LIMITS[key.tier as AgentTier].overagePricePerThousand,
      })),
      pricing: {
        note: 'Overage charges apply only to Builder and Scale tier API keys',
        rates: {
          builder: `$${AGENT_LIMITS.builder.overagePricePerThousand} per 1,000 requests over daily limit`,
          scale: `$${AGENT_LIMITS.scale.overagePricePerThousand} per 1,000 requests over daily limit`,
        },
      },
    };

    return createSuccessResponse(response, requestId);
  } catch (error) {
    console.error('Billing endpoint error:', error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'Internal server error',
      500,
      requestId
    );
  }
}
