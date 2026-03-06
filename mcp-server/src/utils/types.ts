/**
 * Response types for the nullcheck API.
 * These mirror the API response shapes — kept separate from the
 * main app types so the MCP server has zero dependency on the Next.js app.
 */

export type ChainId = 'ethereum' | 'base' | 'solana';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  cached?: boolean;
}

export interface Token {
  address: string;
  chainId: ChainId;
  symbol: string;
  name: string;
  decimals?: number;
  logoUrl?: string | null;
}

export interface TokenMetrics {
  price: number;
  priceChange1h: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number | null;
  txns24h: number;
  buys24h: number;
  sells24h: number;
}

export interface TokenWithMetrics extends Token {
  metrics?: TokenMetrics;
  risk?: RiskScore;
}

export interface RiskScore {
  totalScore: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  liquidity?: LiquidityRisk;
  holders?: HolderRisk;
  contract?: ContractRisk;
  honeypot?: HoneypotRisk;
  warnings?: RiskWarning[];
  analyzedAt?: string;
}

export interface LiquidityRisk {
  score: number;
  liquidity: number;
  lpLocked: boolean;
  lpLockedPercent: number;
}

export interface HolderRisk {
  score: number;
  totalHolders: number;
  top10Percent: number;
  creatorHoldingPercent: number;
}

export interface ContractRisk {
  score: number;
  verified: boolean;
  renounced: boolean;
  hasMintFunction: boolean;
  maxTaxPercent: number;
}

export interface HoneypotRisk {
  score: number;
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  cannotSell: boolean;
}

export interface RiskWarning {
  code: string;
  severity: string;
  message: string;
}

export interface WhaleActivity {
  count24h: number;
  buyCount24h: number;
  sellCount24h: number;
  netFlow24h: number;
  largestTx?: WhaleTransaction;
  recentTransactions?: WhaleTransaction[];
}

export interface WhaleTransaction {
  txHash: string;
  type: 'buy' | 'sell';
  tokenAddress: string;
  chainId: string;
  walletAddress: string;
  amount: number;
  valueUsd: number;
  timestamp: number;
  priceAtTx?: number;
}

export interface TokenHolder {
  address: string;
  balance: string;
  percent: number;
  isContract: boolean;
  isLocked: boolean;
  tag?: string;
}

export interface BatchRiskResult {
  results: Record<string, RiskScore>;
  errors?: Record<string, string>;
  meta: {
    requested: number;
    analyzed?: number;
    succeeded?: number;
    failed?: number;
    cached?: number;
  };
}
