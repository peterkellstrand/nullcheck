import { ChainId } from './chain';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskWarning {
  code: string;
  severity: RiskLevel;
  message: string;
  details?: string;
}

export interface LiquidityRisk {
  score: number; // 0-25
  liquidity: number;
  lpLocked: boolean;
  lpLockedPercent: number;
  lpBurnedPercent: number;
  warnings: RiskWarning[];
}

export interface HolderRisk {
  score: number; // 0-25
  totalHolders: number;
  top10Percent: number;
  top20Percent: number;
  creatorHoldingPercent: number;
  warnings: RiskWarning[];
}

export interface ContractRisk {
  score: number; // 0-30
  verified: boolean;
  renounced: boolean;
  hasProxy: boolean;
  hasMintFunction: boolean;
  hasPauseFunction: boolean;
  hasBlacklistFunction: boolean;
  maxTaxPercent: number;
  warnings: RiskWarning[];
}

export interface HoneypotRisk {
  score: number; // 0-50
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  transferTax: number;
  cannotSell: boolean;
  cannotTransfer: boolean;
  warnings: RiskWarning[];
}

export interface RiskScore {
  tokenAddress: string;
  chainId: ChainId;
  totalScore: number; // 0-150, normalized to 0-100
  level: RiskLevel;
  liquidity: LiquidityRisk;
  holders: HolderRisk;
  contract: ContractRisk;
  honeypot: HoneypotRisk;
  warnings: RiskWarning[];
  analyzedAt: string;
}

export interface RiskAnalysisRequest {
  tokenAddress: string;
  chainId: ChainId;
  poolAddress?: string;
}

export interface RiskAnalysisResponse {
  success: boolean;
  data?: RiskScore;
  error?: string;
  cached?: boolean;
}

// Risk thresholds
export const RISK_THRESHOLDS = {
  low: { min: 0, max: 14 },
  medium: { min: 15, max: 29 },
  high: { min: 30, max: 49 },
  critical: { min: 50, max: 100 },
} as const;

export function getRiskLevel(score: number): RiskLevel {
  if (score <= RISK_THRESHOLDS.low.max) return 'low';
  if (score <= RISK_THRESHOLDS.medium.max) return 'medium';
  if (score <= RISK_THRESHOLDS.high.max) return 'high';
  return 'critical';
}
