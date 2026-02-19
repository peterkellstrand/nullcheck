import { ChainId } from '@/types/chain';
import { RiskScore, RiskLevel } from '@/types/risk';
import {
  WebhookEventType,
  RiskEventData,
  WhaleEventData,
  PriceEventData,
} from '@/types/webhook';
import { dispatchWebhookEvent } from './service';

/**
 * Trigger risk-related webhook events based on risk score
 */
export async function triggerRiskWebhooks(
  tokenAddress: string,
  chainId: ChainId,
  symbol: string,
  name: string,
  riskScore: RiskScore
): Promise<void> {
  const eventData: RiskEventData = {
    type: 'risk',
    tokenAddress,
    chainId,
    symbol,
    name,
    riskScore: riskScore.totalScore,
    riskLevel: riskScore.level,
    isHoneypot: riskScore.honeypot.isHoneypot,
    warnings: riskScore.warnings.map((w) => w.message),
  };

  const context = {
    chainId,
    tokenAddress,
    riskScore: riskScore.totalScore,
  };

  // Determine which events to trigger based on risk level
  const eventsToTrigger: WebhookEventType[] = [];

  if (riskScore.honeypot.isHoneypot) {
    eventsToTrigger.push('risk.honeypot');
  }

  if (riskScore.level === 'critical' || riskScore.totalScore >= 80) {
    eventsToTrigger.push('risk.critical');
  } else if (riskScore.level === 'high' || riskScore.totalScore >= 60) {
    eventsToTrigger.push('risk.high');
  }

  // Dispatch all applicable events
  for (const eventType of eventsToTrigger) {
    try {
      await dispatchWebhookEvent(eventType, eventData, context);
    } catch (error) {
      console.error(`Failed to dispatch webhook ${eventType}:`, error);
    }
  }
}

/**
 * Trigger whale transaction webhook events
 */
export async function triggerWhaleWebhook(
  tokenAddress: string,
  chainId: ChainId,
  symbol: string,
  txHash: string,
  action: 'buy' | 'sell',
  walletAddress: string,
  amount: number,
  valueUsd: number,
  priceAtTx: number
): Promise<void> {
  const eventData: WhaleEventData = {
    type: 'whale',
    tokenAddress,
    chainId,
    symbol,
    txHash,
    action,
    walletAddress,
    amount,
    valueUsd,
    priceAtTx,
  };

  const context = {
    chainId,
    tokenAddress,
    valueUsd,
  };

  const eventType: WebhookEventType = action === 'buy' ? 'whale.buy' : 'whale.sell';

  try {
    await dispatchWebhookEvent(eventType, eventData, context);
  } catch (error) {
    console.error(`Failed to dispatch webhook ${eventType}:`, error);
  }
}

/**
 * Trigger price alert webhook events
 */
export async function triggerPriceWebhook(
  tokenAddress: string,
  chainId: ChainId,
  symbol: string,
  previousPrice: number,
  currentPrice: number
): Promise<void> {
  if (previousPrice === 0) return; // Avoid division by zero

  const changePercent = ((currentPrice - previousPrice) / previousPrice) * 100;
  const direction: 'up' | 'down' = changePercent >= 0 ? 'up' : 'down';

  const eventData: PriceEventData = {
    type: 'price',
    tokenAddress,
    chainId,
    symbol,
    previousPrice,
    currentPrice,
    changePercent,
    direction,
  };

  const context = {
    chainId,
    tokenAddress,
    priceChangePercent: Math.abs(changePercent),
  };

  const eventType: WebhookEventType =
    direction === 'up' ? 'price.increase' : 'price.decrease';

  try {
    await dispatchWebhookEvent(eventType, eventData, context);
  } catch (error) {
    console.error(`Failed to dispatch webhook ${eventType}:`, error);
  }
}

/**
 * Helper to check if risk score should trigger webhooks
 * (Avoids triggering on every request - only on significant changes)
 */
export function shouldTriggerRiskWebhook(
  newScore: RiskScore,
  previousScore?: RiskScore | null
): boolean {
  // Always trigger for honeypots
  if (newScore.honeypot.isHoneypot) return true;

  // Always trigger for critical risk (score >= 80)
  if (newScore.totalScore >= 80) return true;

  // Trigger for high risk (score >= 60) if first analysis
  if (!previousScore) return newScore.totalScore >= 60;

  // Trigger if risk level increased significantly
  const levelOrder: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };

  const previousLevel = levelOrder[previousScore.level];
  const newLevel = levelOrder[newScore.level];

  // Trigger if escalated to high or critical
  return newLevel >= 2 && newLevel > previousLevel;
}

/**
 * Helper to check if price change should trigger webhooks
 */
export function shouldTriggerPriceWebhook(
  previousPrice: number,
  currentPrice: number,
  threshold: number = 5 // Default 5% change
): boolean {
  if (previousPrice === 0) return false;
  const changePercent = Math.abs(((currentPrice - previousPrice) / previousPrice) * 100);
  return changePercent >= threshold;
}
