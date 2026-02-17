import { createClient } from '@supabase/supabase-js';
import {
  WebhookEventType,
  WebhookSubscription,
  WebhookPayload,
  WebhookFilters,
  WebhookDelivery,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  WEBHOOK_MAX_RETRIES,
  WEBHOOK_RETRY_DELAY_MS,
} from '@/types/webhook';
import { ChainId } from '@/types/chain';
import { API_VERSION } from '@/lib/api/utils';

// Service role client for webhook operations (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getServiceClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a unique webhook delivery ID
 */
function generateWebhookId(): string {
  return `wh_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Find all active webhook subscriptions that match the event and filters
 */
export async function getSubscriptionsForEvent(
  eventType: WebhookEventType,
  context: {
    chainId: ChainId;
    tokenAddress?: string;
    riskScore?: number;
    valueUsd?: number;
    priceChangePercent?: number;
  }
): Promise<WebhookSubscription[]> {
  const supabase = getServiceClient();

  // Query active subscriptions that include this event type
  const { data, error } = await supabase
    .from('webhook_subscriptions')
    .select('*')
    .eq('is_active', true)
    .contains('events', [eventType]);

  if (error || !data) {
    console.error('Failed to fetch webhook subscriptions:', error);
    return [];
  }

  // Filter by subscription-specific filters
  return data.filter((sub) => {
    const filters = sub.filters as WebhookFilters | null;
    if (!filters) return true;

    // Chain filter
    if (filters.chains && filters.chains.length > 0) {
      if (!filters.chains.includes(context.chainId)) return false;
    }

    // Token address filter
    if (filters.tokenAddresses && filters.tokenAddresses.length > 0) {
      if (!context.tokenAddress) return false;
      const normalizedAddresses = filters.tokenAddresses.map((a) =>
        context.chainId === 'solana' ? a : a.toLowerCase()
      );
      const normalizedContext =
        context.chainId === 'solana' ? context.tokenAddress : context.tokenAddress.toLowerCase();
      if (!normalizedAddresses.includes(normalizedContext)) return false;
    }

    // Risk score filter
    if (filters.minRiskScore !== undefined && context.riskScore !== undefined) {
      if (context.riskScore < filters.minRiskScore) return false;
    }

    // Value filter (for whale events)
    if (filters.minValueUsd !== undefined && context.valueUsd !== undefined) {
      if (context.valueUsd < filters.minValueUsd) return false;
    }

    // Price change filter
    if (filters.priceChangePercent !== undefined && context.priceChangePercent !== undefined) {
      if (Math.abs(context.priceChangePercent) < filters.priceChangePercent) return false;
    }

    return true;
  }).map((sub) => ({
    id: sub.id,
    apiKeyId: sub.api_key_id,
    webhookUrl: sub.webhook_url,
    events: sub.events,
    isActive: sub.is_active,
    secret: sub.secret,
    filters: sub.filters,
    createdAt: sub.created_at,
    updatedAt: sub.updated_at,
    lastTriggered: sub.last_triggered,
    failureCount: sub.failure_count,
  }));
}

/**
 * Create a webhook payload with signature
 */
export function createPayload(
  event: WebhookEventType,
  data: WebhookPayload['data']
): WebhookPayload {
  return {
    id: generateWebhookId(),
    event,
    timestamp: new Date().toISOString(),
    apiVersion: API_VERSION,
    data,
  };
}

/**
 * Deliver a webhook to a subscription endpoint
 */
export async function deliverWebhook(
  subscription: WebhookSubscription,
  payload: WebhookPayload
): Promise<WebhookDelivery> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payloadString = JSON.stringify(payload);
  const signatureData = `${timestamp}.${payloadString}`;
  const signature = await signPayload(signatureData, subscription.secret);

  let lastError: Error | null = null;
  let responseCode: number | null = null;
  let responseBody: string | null = null;
  let success = false;

  // Retry loop with exponential backoff
  for (let attempt = 0; attempt < WEBHOOK_MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(subscription.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [WEBHOOK_SIGNATURE_HEADER]: `v1=${signature}`,
          [WEBHOOK_TIMESTAMP_HEADER]: timestamp,
          'User-Agent': 'Nullcheck-Webhook/1.0',
        },
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      responseCode = response.status;
      responseBody = await response.text().catch(() => null);

      // Success if 2xx status
      if (response.ok) {
        success = true;
        break;
      }

      // Don't retry on 4xx (client errors)
      if (response.status >= 400 && response.status < 500) {
        break;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error');
      responseCode = null;
      responseBody = lastError.message;
    }

    // Wait before retry (exponential backoff)
    if (attempt < WEBHOOK_MAX_RETRIES - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, WEBHOOK_RETRY_DELAY_MS * Math.pow(2, attempt))
      );
    }
  }

  // Log the delivery
  const delivery = await logDelivery(subscription.id, payload, {
    responseCode,
    responseBody,
    success,
  });

  // Update subscription status
  await updateSubscriptionStatus(subscription.id, success);

  return delivery;
}

/**
 * Log webhook delivery to database
 */
async function logDelivery(
  subscriptionId: string,
  payload: WebhookPayload,
  result: { responseCode: number | null; responseBody: string | null; success: boolean }
): Promise<WebhookDelivery> {
  const supabase = getServiceClient();

  const delivery: WebhookDelivery = {
    id: payload.id,
    subscriptionId,
    eventType: payload.event,
    payload,
    responseCode: result.responseCode,
    responseBody: result.responseBody,
    deliveredAt: new Date().toISOString(),
    success: result.success,
  };

  const { error } = await supabase.from('webhook_deliveries').insert({
    id: delivery.id,
    subscription_id: subscriptionId,
    event_type: payload.event,
    payload: payload,
    response_code: result.responseCode,
    response_body: result.responseBody,
    delivered_at: delivery.deliveredAt,
    success: result.success,
  });

  if (error) {
    console.error('Failed to log webhook delivery:', error);
  }

  return delivery;
}

/**
 * Update subscription last_triggered and failure_count
 */
async function updateSubscriptionStatus(subscriptionId: string, success: boolean): Promise<void> {
  const supabase = getServiceClient();

  if (success) {
    await supabase
      .from('webhook_subscriptions')
      .update({
        last_triggered: new Date().toISOString(),
        failure_count: 0,
      })
      .eq('id', subscriptionId);
  } else {
    // Increment failure count, disable if too many failures
    const { data } = await supabase
      .from('webhook_subscriptions')
      .select('failure_count')
      .eq('id', subscriptionId)
      .single();

    const newFailureCount = (data?.failure_count || 0) + 1;
    const shouldDisable = newFailureCount >= 10; // Disable after 10 consecutive failures

    await supabase
      .from('webhook_subscriptions')
      .update({
        last_triggered: new Date().toISOString(),
        failure_count: newFailureCount,
        is_active: !shouldDisable,
      })
      .eq('id', subscriptionId);

    if (shouldDisable) {
      console.warn(`Webhook subscription ${subscriptionId} disabled due to failures`);
    }
  }
}

/**
 * Dispatch an event to all matching webhook subscriptions
 */
export async function dispatchWebhookEvent(
  eventType: WebhookEventType,
  data: WebhookPayload['data'],
  context: {
    chainId: ChainId;
    tokenAddress?: string;
    riskScore?: number;
    valueUsd?: number;
    priceChangePercent?: number;
  }
): Promise<{ dispatched: number; successful: number }> {
  const subscriptions = await getSubscriptionsForEvent(eventType, context);

  if (subscriptions.length === 0) {
    return { dispatched: 0, successful: 0 };
  }

  const payload = createPayload(eventType, data);
  const results = await Promise.allSettled(
    subscriptions.map((sub) => deliverWebhook(sub, payload))
  );

  const successful = results.filter(
    (r) => r.status === 'fulfilled' && r.value.success
  ).length;

  return { dispatched: subscriptions.length, successful };
}

/**
 * Generate a new webhook secret
 */
export function generateWebhookSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
