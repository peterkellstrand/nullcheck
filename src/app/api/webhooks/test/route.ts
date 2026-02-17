import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyApiAccess, createRateLimitHeaders } from '@/lib/auth/verify-api-access';
import {
  generateRequestId,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
  ERROR_CODES,
} from '@/lib/api/utils';
import { WebhookSubscription } from '@/types/webhook';
import { createPayload, deliverWebhook } from '@/lib/webhooks/service';

export const runtime = 'nodejs';

export const OPTIONS = handleCorsOptions;

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
 * POST /api/webhooks/test?id=xxx - Send a test webhook to verify endpoint
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  // Verify API access
  const access = await verifyApiAccess(request);
  const rateLimitHeaders = createRateLimitHeaders(access);

  if (access.type === 'error') {
    return createErrorResponse(
      access.code,
      access.error,
      access.code === 'RATE_LIMITED' ? 429 : 401,
      requestId,
      undefined,
      rateLimitHeaders
    );
  }

  if (access.type !== 'agent') {
    return createErrorResponse(
      ERROR_CODES.UNAUTHORIZED,
      'Webhook management requires API key authentication',
      401,
      requestId
    );
  }

  const { searchParams } = new URL(request.url);
  const webhookId = searchParams.get('id');

  if (!webhookId) {
    return createErrorResponse(
      ERROR_CODES.VALIDATION_ERROR,
      'Webhook ID required',
      400,
      requestId,
      undefined,
      rateLimitHeaders
    );
  }

  try {
    const supabase = getServiceClient();

    // Get webhook subscription
    const { data, error } = await supabase
      .from('webhook_subscriptions')
      .select('*')
      .eq('id', webhookId)
      .single();

    if (error || !data) {
      return createErrorResponse(
        ERROR_CODES.NOT_FOUND,
        'Webhook not found',
        404,
        requestId,
        undefined,
        rateLimitHeaders
      );
    }

    // Verify ownership
    if (data.api_key_id !== access.keyId) {
      return createErrorResponse(
        ERROR_CODES.NOT_FOUND,
        'Webhook not found',
        404,
        requestId,
        undefined,
        rateLimitHeaders
      );
    }

    const subscription: WebhookSubscription = {
      id: data.id,
      apiKeyId: data.api_key_id,
      webhookUrl: data.webhook_url,
      events: data.events,
      isActive: data.is_active,
      secret: data.secret,
      filters: data.filters,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      lastTriggered: data.last_triggered,
      failureCount: data.failure_count,
    };

    // Create test payload
    const testPayload = createPayload('risk.high', {
      type: 'risk',
      tokenAddress: '0x0000000000000000000000000000000000000000',
      chainId: 'ethereum',
      symbol: 'TEST',
      name: 'Test Token',
      riskScore: 75,
      riskLevel: 'high',
      isHoneypot: false,
      warnings: ['This is a test webhook delivery'],
    });

    // Mark as test event
    (testPayload as unknown as Record<string, unknown>).test = true;

    // Deliver the test webhook
    const delivery = await deliverWebhook(subscription, testPayload);

    return createSuccessResponse(
      {
        success: delivery.success,
        delivery: {
          id: delivery.id,
          responseCode: delivery.responseCode,
          responseBody: delivery.responseBody?.substring(0, 500), // Truncate response
          deliveredAt: delivery.deliveredAt,
        },
        message: delivery.success
          ? 'Test webhook delivered successfully'
          : 'Test webhook delivery failed',
      },
      requestId,
      { rateLimitHeaders }
    );
  } catch (error) {
    console.error('Webhook test error:', error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'Internal server error',
      500,
      requestId,
      undefined,
      rateLimitHeaders
    );
  }
}
