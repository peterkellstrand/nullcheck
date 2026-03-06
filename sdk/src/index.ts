/**
 * @nullcheck/sdk — DeFi token risk analysis for AI agents and developers.
 *
 * Detect honeypots, rug pulls, and scams across Ethereum, Base, and Solana.
 *
 * @example
 * ```typescript
 * import { createNullcheck } from '@nullcheck/sdk';
 *
 * const nc = createNullcheck({ apiKey: 'nk_your_key_here' });
 *
 * // Screen a token before trading
 * const risk = await nc.analyzeRisk('solana', 'TOKEN_ADDRESS');
 * console.log(`Risk: ${risk.level} (${risk.totalScore}/100)`);
 *
 * // Batch screen a portfolio
 * const batch = await nc.batchRisk([
 *   { chain: 'ethereum', address: '0x...' },
 *   { chain: 'solana', address: 'DezX...' },
 * ]);
 *
 * // Check whale activity
 * const whales = await nc.getWhaleActivity('solana', 'TOKEN_ADDRESS');
 * console.log(`Net flow: ${whales.netFlow24h > 0 ? 'bullish' : 'bearish'}`);
 * ```
 *
 * @packageDocumentation
 */

export { NullcheckClient, NullcheckApiError } from './client.js';

export type {
  ApiResponse,
  BatchRiskResult,
  ChainId,
  ContractRisk,
  HolderRisk,
  HoneypotRisk,
  LiquidityRisk,
  NullcheckOptions,
  RiskLevel,
  RiskScore,
  RiskWarning,
  Token,
  TokenHolder,
  TokenMetrics,
  TokenWithMetrics,
  WhaleActivity,
  WhaleTransaction,
} from './types.js';

import { NullcheckClient } from './client.js';
import type { NullcheckOptions } from './types.js';

/**
 * Create a nullcheck client.
 *
 * @param options - API key and optional configuration
 * @returns Configured NullcheckClient instance
 *
 * @example
 * ```typescript
 * const nc = createNullcheck({ apiKey: 'nk_your_key_here' });
 * const risk = await nc.analyzeRisk('solana', 'TOKEN_ADDRESS');
 * ```
 */
export function createNullcheck(options: NullcheckOptions): NullcheckClient {
  return new NullcheckClient(options);
}
