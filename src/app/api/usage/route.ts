import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer, getSupabaseServerWithServiceRole } from '@/lib/db/supabase-server';
import { getCorsHeaders, generateRequestId, createErrorResponse, createSuccessResponse, ERROR_CODES } from '@/lib/api/utils';

export const runtime = 'nodejs'; // Requires server-side DB access

interface DailyUsage {
  date: string;
  requestCount: number;
}

interface KeyUsage {
  keyId: string;
  name: string;
  tier: string;
  dailyLimit: number;
  totalRequests: number;
  usage: DailyUsage[];
  lastUsed: string | null;
}

interface UsageResponse {
  period: {
    start: string;
    end: string;
    days: number;
  };
  summary: {
    totalRequests: number;
    totalKeys: number;
    averageDaily: number;
    peakDay: {
      date: string;
      requests: number;
    } | null;
  };
  keys: KeyUsage[];
}

// GET - Get usage data for authenticated user's API keys
export async function GET(req: NextRequest) {
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

    // Parse query params
    const { searchParams } = new URL(req.url);
    const daysParam = searchParams.get('days');
    const days = Math.min(Math.max(parseInt(daysParam || '30', 10), 1), 90); // 1-90 days

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const service = await getSupabaseServerWithServiceRole();

    // Get user's API keys
    const { data: keys, error: keysError } = await service
      .from('api_keys')
      .select('id, name, tier, daily_limit, last_used, created_at')
      .eq('user_id', user.id)
      .eq('is_revoked', false)
      .order('created_at', { ascending: false });

    if (keysError) {
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to fetch API keys',
        500,
        requestId
      );
    }

    if (!keys || keys.length === 0) {
      const response: UsageResponse = {
        period: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
          days,
        },
        summary: {
          totalRequests: 0,
          totalKeys: 0,
          averageDaily: 0,
          peakDay: null,
        },
        keys: [],
      };
      return createSuccessResponse(response, requestId);
    }

    // Get usage data for all keys in the period
    const keyIds = keys.map((k) => k.id);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const { data: usageData, error: usageError } = await service
      .from('api_usage')
      .select('api_key_id, date, request_count')
      .in('api_key_id', keyIds)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true });

    if (usageError) {
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to fetch usage data',
        500,
        requestId
      );
    }

    // Group usage by key
    const usageByKey = new Map<string, DailyUsage[]>();
    const dailyTotals = new Map<string, number>();

    (usageData || []).forEach((row) => {
      const keyUsage = usageByKey.get(row.api_key_id) || [];
      keyUsage.push({
        date: row.date,
        requestCount: row.request_count,
      });
      usageByKey.set(row.api_key_id, keyUsage);

      // Track daily totals for peak calculation
      const currentTotal = dailyTotals.get(row.date) || 0;
      dailyTotals.set(row.date, currentTotal + row.request_count);
    });

    // Build response
    let totalRequests = 0;
    let peakDay: { date: string; requests: number } | null = null;

    // Find peak day
    dailyTotals.forEach((requests, date) => {
      if (!peakDay || requests > peakDay.requests) {
        peakDay = { date, requests };
      }
    });

    const keyUsages: KeyUsage[] = keys.map((key) => {
      const usage = usageByKey.get(key.id) || [];
      const keyTotal = usage.reduce((sum, u) => sum + u.requestCount, 0);
      totalRequests += keyTotal;

      return {
        keyId: key.id,
        name: key.name,
        tier: key.tier,
        dailyLimit: key.daily_limit,
        totalRequests: keyTotal,
        usage,
        lastUsed: key.last_used,
      };
    });

    const response: UsageResponse = {
      period: {
        start: startDateStr,
        end: endDateStr,
        days,
      },
      summary: {
        totalRequests,
        totalKeys: keys.length,
        averageDaily: Math.round(totalRequests / days),
        peakDay,
      },
      keys: keyUsages,
    };

    return createSuccessResponse(response, requestId);
  } catch (error) {
    console.error('Usage endpoint error:', error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'Internal server error',
      500,
      requestId
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}
