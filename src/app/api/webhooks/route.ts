import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyApiAccess, createRateLimitHeaders } from '@/lib/auth/verify-api-access';
import {
  generateRequestId,
  getCorsHeaders,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
  ERROR_CODES,
} from '@/lib/api/utils';
import {
  WebhookSubscription,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  isValidWebhookUrl,
  isValidEventTypes,
  WEBHOOK_EVENT_TYPES,
} from '@/types/webhook';
import { generateWebhookSecret } from '@/lib/webhooks/service';

export const runtime = 'nodejs';

export const OPTIONS = handleCorsOptions;

// Service role client for webhook operations
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

// Maximum webhooks per API key
const MAX_WEBHOOKS_PER_KEY = 10;

/**
 * GET /api/webhooks - List webhook subscriptions for the authenticated API key
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();

  // Verify API access (must be agent with API key)
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

  // Webhooks require API key authentication
  if (access.type !== 'agent') {
    return createErrorResponse(
      ERROR_CODES.UNAUTHORIZED,
      'Webhook management requires API key authentication',
      401,
      requestId
    );
  }

  try {
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('webhook_subscriptions')
      .select('*')
      .eq('api_key_id', access.keyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch webhooks:', error);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to fetch webhooks',
        500,
        requestId,
        undefined,
        rateLimitHeaders
      );
    }

    // SECURITY: Never return secrets in GET response - only shown at creation time
    const webhooks: Omit<WebhookSubscription, 'secret'>[] = (data || []).map((row) => ({
      id: row.id,
      apiKeyId: row.api_key_id,
      webhookUrl: row.webhook_url,
      events: row.events,
      isActive: row.is_active,
      // secret intentionally omitted - only returned on POST
      filters: row.filters,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastTriggered: row.last_triggered,
      failureCount: row.failure_count,
    }));

    return createSuccessResponse(
      {
        webhooks,
        count: webhooks.length,
        maxAllowed: MAX_WEBHOOKS_PER_KEY,
      },
      requestId,
      { rateLimitHeaders }
    );
  } catch (error) {
    console.error('Webhook list error:', error);
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

/**
 * POST /api/webhooks - Create a new webhook subscription
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

  try {
    const body: CreateWebhookRequest = await request.json();

    // Validate webhook URL
    if (!body.webhookUrl || !isValidWebhookUrl(body.webhookUrl)) {
      return createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid webhook URL. Must be HTTPS.',
        400,
        requestId,
        { field: 'webhookUrl' },
        rateLimitHeaders
      );
    }

    // Validate events
    if (!isValidEventTypes(body.events)) {
      return createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid or empty events array',
        400,
        requestId,
        { field: 'events', validEvents: WEBHOOK_EVENT_TYPES },
        rateLimitHeaders
      );
    }

    const supabase = getServiceClient();

    // Check existing webhook count
    const { count } = await supabase
      .from('webhook_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('api_key_id', access.keyId);

    if ((count || 0) >= MAX_WEBHOOKS_PER_KEY) {
      return createErrorResponse(
        'WEBHOOK_LIMIT_EXCEEDED',
        `Maximum ${MAX_WEBHOOKS_PER_KEY} webhooks per API key`,
        400,
        requestId,
        { current: count, max: MAX_WEBHOOKS_PER_KEY },
        rateLimitHeaders
      );
    }

    // Check for duplicate URL
    const { data: existing } = await supabase
      .from('webhook_subscriptions')
      .select('id')
      .eq('api_key_id', access.keyId)
      .eq('webhook_url', body.webhookUrl)
      .single();

    if (existing) {
      return createErrorResponse(
        'DUPLICATE_WEBHOOK',
        'A webhook with this URL already exists',
        400,
        requestId,
        { existingId: existing.id },
        rateLimitHeaders
      );
    }

    // Generate secret for signature verification
    const secret = generateWebhookSecret();

    // Create webhook subscription
    const { data, error } = await supabase
      .from('webhook_subscriptions')
      .insert({
        api_key_id: access.keyId,
        webhook_url: body.webhookUrl,
        events: body.events,
        filters: body.filters || null,
        secret,
        is_active: true,
        failure_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create webhook:', error);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to create webhook',
        500,
        requestId,
        undefined,
        rateLimitHeaders
      );
    }

    const webhook: WebhookSubscription = {
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

    return createSuccessResponse(
      {
        webhook,
        message: 'Webhook created successfully. Save the secret for signature verification.',
      },
      requestId,
      { status: 201, rateLimitHeaders }
    );
  } catch (error) {
    console.error('Webhook create error:', error);
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

/**
 * PATCH /api/webhooks?id=xxx - Update a webhook subscription
 */
export async function PATCH(request: NextRequest) {
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
    const body: UpdateWebhookRequest = await request.json();
    const supabase = getServiceClient();

    // Verify ownership
    const { data: existing } = await supabase
      .from('webhook_subscriptions')
      .select('id, api_key_id')
      .eq('id', webhookId)
      .single();

    if (!existing || existing.api_key_id !== access.keyId) {
      return createErrorResponse(
        ERROR_CODES.NOT_FOUND,
        'Webhook not found',
        404,
        requestId,
        undefined,
        rateLimitHeaders
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.webhookUrl !== undefined) {
      if (!isValidWebhookUrl(body.webhookUrl)) {
        return createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid webhook URL. Must be HTTPS.',
          400,
          requestId,
          { field: 'webhookUrl' },
          rateLimitHeaders
        );
      }
      updates.webhook_url = body.webhookUrl;
    }

    if (body.events !== undefined) {
      if (!isValidEventTypes(body.events)) {
        return createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid events array',
          400,
          requestId,
          { field: 'events', validEvents: WEBHOOK_EVENT_TYPES },
          rateLimitHeaders
        );
      }
      updates.events = body.events;
    }

    if (body.filters !== undefined) {
      updates.filters = body.filters;
    }

    if (body.isActive !== undefined) {
      updates.is_active = body.isActive;
      // Reset failure count when re-enabling
      if (body.isActive) {
        updates.failure_count = 0;
      }
    }

    const { data, error } = await supabase
      .from('webhook_subscriptions')
      .update(updates)
      .eq('id', webhookId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update webhook:', error);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to update webhook',
        500,
        requestId,
        undefined,
        rateLimitHeaders
      );
    }

    const webhook: WebhookSubscription = {
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

    return createSuccessResponse({ webhook }, requestId, { rateLimitHeaders });
  } catch (error) {
    console.error('Webhook update error:', error);
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

/**
 * DELETE /api/webhooks?id=xxx - Delete a webhook subscription
 */
export async function DELETE(request: NextRequest) {
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

    // Verify ownership
    const { data: existing } = await supabase
      .from('webhook_subscriptions')
      .select('id, api_key_id')
      .eq('id', webhookId)
      .single();

    if (!existing || existing.api_key_id !== access.keyId) {
      return createErrorResponse(
        ERROR_CODES.NOT_FOUND,
        'Webhook not found',
        404,
        requestId,
        undefined,
        rateLimitHeaders
      );
    }

    // Delete the webhook
    const { error } = await supabase
      .from('webhook_subscriptions')
      .delete()
      .eq('id', webhookId);

    if (error) {
      console.error('Failed to delete webhook:', error);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to delete webhook',
        500,
        requestId,
        undefined,
        rateLimitHeaders
      );
    }

    return createSuccessResponse(
      { deleted: true, id: webhookId },
      requestId,
      { rateLimitHeaders }
    );
  } catch (error) {
    console.error('Webhook delete error:', error);
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
