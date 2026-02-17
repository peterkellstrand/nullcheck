import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  generateRequestId,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api/utils';

export const runtime = 'nodejs';

/**
 * Get service role client for admin operations
 */
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
 * Verify admin access via service key or admin user
 */
function verifyAdminAccess(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.ADMIN_SECRET;

  // Check admin secret
  if (adminSecret && authHeader === `Bearer ${adminSecret}`) {
    return true;
  }

  // In development, allow access
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return false;
}

/**
 * GET /api/admin/metrics - Get system metrics for monitoring dashboard
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();

  if (!verifyAdminAccess(request)) {
    return createErrorResponse('UNAUTHORIZED', 'Admin access required', 401, requestId);
  }

  try {
    const supabase = getServiceClient();
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fetch metrics in parallel
    const [
      apiKeysResult,
      usageTodayResult,
      usageYesterdayResult,
      usageWeekResult,
      webhooksResult,
      webhookDeliveriesResult,
      tokensResult,
      riskScoresResult,
    ] = await Promise.all([
      // API Keys count by tier
      supabase
        .from('api_keys')
        .select('tier', { count: 'exact' }),

      // Today's usage
      supabase
        .from('api_usage')
        .select('request_count')
        .eq('date', today),

      // Yesterday's usage
      supabase
        .from('api_usage')
        .select('request_count')
        .eq('date', yesterday),

      // Last 7 days usage
      supabase
        .from('api_usage')
        .select('request_count')
        .gte('date', lastWeek),

      // Active webhooks
      supabase
        .from('webhook_subscriptions')
        .select('id, enabled', { count: 'exact' })
        .eq('enabled', true),

      // Recent webhook deliveries (last 24h)
      supabase
        .from('webhook_deliveries')
        .select('status_code, success')
        .gte('delivered_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()),

      // Tokens in database
      supabase
        .from('tokens')
        .select('id', { count: 'exact', head: true }),

      // Risk scores analyzed today
      supabase
        .from('risk_scores')
        .select('id', { count: 'exact', head: true })
        .gte('analyzed_at', today),
    ]);

    // Calculate API key metrics
    const apiKeysByTier: Record<string, number> = {};
    if (apiKeysResult.data) {
      for (const key of apiKeysResult.data) {
        apiKeysByTier[key.tier] = (apiKeysByTier[key.tier] || 0) + 1;
      }
    }

    // Calculate usage metrics
    const usageToday = usageTodayResult.data?.reduce((sum, u) => sum + u.request_count, 0) || 0;
    const usageYesterday = usageYesterdayResult.data?.reduce((sum, u) => sum + u.request_count, 0) || 0;
    const usageWeek = usageWeekResult.data?.reduce((sum, u) => sum + u.request_count, 0) || 0;

    // Calculate webhook metrics
    const webhookDeliveries = webhookDeliveriesResult.data || [];
    const successfulDeliveries = webhookDeliveries.filter(d => d.success).length;
    const failedDeliveries = webhookDeliveries.filter(d => !d.success).length;

    const metrics = {
      timestamp: now.toISOString(),
      apiKeys: {
        total: apiKeysResult.count || 0,
        byTier: apiKeysByTier,
      },
      usage: {
        today: usageToday,
        yesterday: usageYesterday,
        last7Days: usageWeek,
        changeFromYesterday: usageYesterday > 0
          ? Math.round(((usageToday - usageYesterday) / usageYesterday) * 100)
          : 0,
      },
      webhooks: {
        activeSubscriptions: webhooksResult.count || 0,
        deliveriesLast24h: webhookDeliveries.length,
        successfulDeliveries,
        failedDeliveries,
        successRate: webhookDeliveries.length > 0
          ? Math.round((successfulDeliveries / webhookDeliveries.length) * 100)
          : 100,
      },
      database: {
        tokensIndexed: tokensResult.count || 0,
        riskScoresToday: riskScoresResult.count || 0,
      },
    };

    return createSuccessResponse(metrics, requestId);
  } catch (error) {
    console.error('Admin metrics error:', error);
    return createErrorResponse(
      'INTERNAL_ERROR',
      'Failed to fetch metrics',
      500,
      requestId
    );
  }
}
