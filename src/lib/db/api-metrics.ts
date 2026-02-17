import { getSupabaseServerWithServiceRole } from './supabase-server';

export interface ApiMetric {
  apiKeyId?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  cached: boolean;
  requestId: string;
}

/**
 * Log an API request metric (fire and forget)
 * This is non-blocking to avoid slowing down API responses
 */
export async function logApiMetric(metric: ApiMetric): Promise<void> {
  try {
    const service = await getSupabaseServerWithServiceRole();
    await service.from('api_metrics').insert({
      api_key_id: metric.apiKeyId || null,
      endpoint: metric.endpoint,
      method: metric.method,
      status_code: metric.statusCode,
      response_time_ms: metric.responseTimeMs,
      cached: metric.cached,
      request_id: metric.requestId,
    });
  } catch (error) {
    // Log but don't throw - metrics should never break the API
    console.error('Failed to log API metric:', error);
  }
}

/**
 * Get API usage statistics for a given API key
 */
export async function getApiKeyStats(apiKeyId: string): Promise<{
  totalRequests: number;
  todayRequests: number;
  avgResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
} | null> {
  try {
    const service = await getSupabaseServerWithServiceRole();
    const today = new Date().toISOString().split('T')[0];

    // Get total requests
    const { count: totalRequests } = await service
      .from('api_metrics')
      .select('*', { count: 'exact', head: true })
      .eq('api_key_id', apiKeyId);

    // Get today's requests
    const { count: todayRequests } = await service
      .from('api_metrics')
      .select('*', { count: 'exact', head: true })
      .eq('api_key_id', apiKeyId)
      .gte('created_at', today);

    // Get aggregated stats (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentMetrics } = await service
      .from('api_metrics')
      .select('response_time_ms, cached, status_code')
      .eq('api_key_id', apiKeyId)
      .gte('created_at', yesterday);

    if (!recentMetrics || recentMetrics.length === 0) {
      return {
        totalRequests: totalRequests || 0,
        todayRequests: todayRequests || 0,
        avgResponseTime: 0,
        cacheHitRate: 0,
        errorRate: 0,
      };
    }

    const avgResponseTime =
      recentMetrics.reduce((sum, m) => sum + (m.response_time_ms || 0), 0) /
      recentMetrics.length;

    const cacheHits = recentMetrics.filter((m) => m.cached).length;
    const cacheHitRate = cacheHits / recentMetrics.length;

    const errors = recentMetrics.filter((m) => m.status_code >= 500).length;
    const errorRate = errors / recentMetrics.length;

    return {
      totalRequests: totalRequests || 0,
      todayRequests: todayRequests || 0,
      avgResponseTime: Math.round(avgResponseTime),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
    };
  } catch (error) {
    console.error('Failed to get API key stats:', error);
    return null;
  }
}

/**
 * Store idempotent request result
 */
export async function storeIdempotentRequest(
  idempotencyKey: string,
  apiKeyId: string,
  requestPath: string,
  requestBody: unknown,
  responseData: unknown,
  statusCode: number
): Promise<void> {
  try {
    const service = await getSupabaseServerWithServiceRole();

    // Hash the request body for validation
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(requestBody));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const requestHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    await service.from('idempotent_requests').upsert({
      idempotency_key: idempotencyKey,
      api_key_id: apiKeyId,
      request_path: requestPath,
      request_hash: requestHash,
      response_data: responseData,
      status_code: statusCode,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    }, {
      onConflict: 'idempotency_key,api_key_id'
    });
  } catch (error) {
    console.error('Failed to store idempotent request:', error);
  }
}

/**
 * Get cached idempotent request result
 */
export async function getIdempotentRequest(
  idempotencyKey: string,
  apiKeyId: string
): Promise<{ responseData: unknown; statusCode: number } | null> {
  try {
    const service = await getSupabaseServerWithServiceRole();

    const { data } = await service
      .from('idempotent_requests')
      .select('response_data, status_code, expires_at')
      .eq('idempotency_key', idempotencyKey)
      .eq('api_key_id', apiKeyId)
      .single();

    if (!data) return null;

    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      return null;
    }

    return {
      responseData: data.response_data,
      statusCode: data.status_code,
    };
  } catch {
    return null;
  }
}

/**
 * Log a Stripe webhook event
 */
export async function logWebhookEvent(
  provider: string,
  eventId: string,
  eventType: string,
  payload: unknown
): Promise<boolean> {
  try {
    const service = await getSupabaseServerWithServiceRole();

    const { error } = await service.from('webhook_events').insert({
      provider,
      event_id: eventId,
      event_type: eventType,
      payload,
    });

    // If duplicate event ID, it's already been processed
    if (error?.code === '23505') {
      return false; // Already processed
    }

    return true; // New event
  } catch (error) {
    console.error('Failed to log webhook event:', error);
    return true; // Proceed anyway to not block webhooks
  }
}

/**
 * Mark a webhook event as processed
 */
export async function markWebhookProcessed(
  eventId: string,
  error?: string
): Promise<void> {
  try {
    const service = await getSupabaseServerWithServiceRole();

    await service
      .from('webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        error: error || null,
      })
      .eq('event_id', eventId);
  } catch (err) {
    console.error('Failed to mark webhook processed:', err);
  }
}
