import { ChainId } from './chain';

/**
 * Webhook event types that agents can subscribe to
 */
export type WebhookEventType =
  | 'risk.high'           // Token risk score exceeds high threshold (60+)
  | 'risk.critical'       // Token flagged as critical risk (80+)
  | 'risk.honeypot'       // Token detected as honeypot
  | 'whale.buy'           // Large buy transaction detected
  | 'whale.sell'          // Large sell transaction detected
  | 'price.increase'      // Price increased by threshold %
  | 'price.decrease';     // Price decreased by threshold %

/**
 * Webhook subscription configuration
 */
export interface WebhookSubscription {
  id: string;
  apiKeyId: string;
  webhookUrl: string;
  events: WebhookEventType[];
  isActive: boolean;
  secret: string;
  filters?: WebhookFilters;
  createdAt: string;
  updatedAt: string;
  lastTriggered?: string;
  failureCount: number;
}

/**
 * Filters to narrow down which events trigger webhooks
 */
export interface WebhookFilters {
  chains?: ChainId[];
  tokenAddresses?: string[];
  minRiskScore?: number;
  minValueUsd?: number;
  priceChangePercent?: number;
}

/**
 * Payload sent to webhook endpoint
 */
export interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  timestamp: string;
  apiVersion: string;
  data: WebhookEventData;
}

/**
 * Event-specific data included in webhook payload
 */
export type WebhookEventData =
  | RiskEventData
  | WhaleEventData
  | PriceEventData;

export interface RiskEventData {
  type: 'risk';
  tokenAddress: string;
  chainId: ChainId;
  symbol: string;
  name: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  isHoneypot: boolean;
  warnings: string[];
}

export interface WhaleEventData {
  type: 'whale';
  tokenAddress: string;
  chainId: ChainId;
  symbol: string;
  txHash: string;
  action: 'buy' | 'sell';
  walletAddress: string;
  amount: number;
  valueUsd: number;
  priceAtTx: number;
}

export interface PriceEventData {
  type: 'price';
  tokenAddress: string;
  chainId: ChainId;
  symbol: string;
  previousPrice: number;
  currentPrice: number;
  changePercent: number;
  direction: 'up' | 'down';
}

/**
 * Webhook delivery record
 */
export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  eventType: WebhookEventType;
  payload: WebhookPayload;
  responseCode: number | null;
  responseBody: string | null;
  deliveredAt: string;
  success: boolean;
}

/**
 * Request to create a new webhook subscription
 */
export interface CreateWebhookRequest {
  webhookUrl: string;
  events: WebhookEventType[];
  filters?: WebhookFilters;
}

/**
 * Request to update an existing webhook subscription
 */
export interface UpdateWebhookRequest {
  webhookUrl?: string;
  events?: WebhookEventType[];
  filters?: WebhookFilters;
  isActive?: boolean;
}

/**
 * Webhook signature header name
 */
export const WEBHOOK_SIGNATURE_HEADER = 'X-Nullcheck-Signature';

/**
 * Webhook timestamp header name (for replay protection)
 */
export const WEBHOOK_TIMESTAMP_HEADER = 'X-Nullcheck-Timestamp';

/**
 * Maximum age of webhook timestamp before rejection (5 minutes)
 */
export const WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Maximum retry attempts for failed webhook deliveries
 */
export const WEBHOOK_MAX_RETRIES = 3;

/**
 * Delay between retry attempts (exponential backoff base)
 */
export const WEBHOOK_RETRY_DELAY_MS = 1000;

/**
 * All available webhook event types
 */
export const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  'risk.high',
  'risk.critical',
  'risk.honeypot',
  'whale.buy',
  'whale.sell',
  'price.increase',
  'price.decrease',
];

/**
 * Validate webhook URL format
 */
export function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate event types array
 */
export function isValidEventTypes(events: unknown): events is WebhookEventType[] {
  if (!Array.isArray(events) || events.length === 0) return false;
  return events.every((e) => WEBHOOK_EVENT_TYPES.includes(e as WebhookEventType));
}
