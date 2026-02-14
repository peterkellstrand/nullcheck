import { ChainId } from './chain';

export interface TokenHolder {
  address: string;
  balance: string;
  percent: number;
  isContract: boolean;
  isLocked: boolean;
  tag?: string; // "DEX", "Burn", "Team", "LP", etc.
}

export interface WhaleTransaction {
  txHash: string;
  type: 'buy' | 'sell';
  tokenAddress: string;
  chainId: ChainId;
  walletAddress: string;
  amount: number;
  valueUsd: number;
  timestamp: number;
  priceAtTx?: number;
}

export interface WhaleActivity {
  count24h: number;
  buyCount24h: number;
  sellCount24h: number;
  netFlow24h: number; // Positive = more buys, negative = more sells
  largestTx?: WhaleTransaction;
  recentTransactions?: WhaleTransaction[];
}

export const WHALE_THRESHOLDS = {
  minValueUsd: 10000, // $10k minimum to be considered whale tx
  minSupplyPercent: 1, // Or 1% of supply
} as const;

// Helper to truncate wallet addresses
export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// Helper to determine if activity is bullish/bearish
export function getActivitySentiment(activity: WhaleActivity): 'bullish' | 'bearish' | 'neutral' {
  if (activity.netFlow24h > 0) return 'bullish';
  if (activity.netFlow24h < 0) return 'bearish';
  return 'neutral';
}
