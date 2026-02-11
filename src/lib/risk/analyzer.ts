import { ChainId } from '@/types/chain';
import {
  RiskScore,
  RiskLevel,
  RiskWarning,
  getRiskLevel,
  RISK_THRESHOLDS,
} from '@/types/risk';
import { detectHoneypot } from './honeypot';
import { analyzeHolders } from './holders';
import { analyzeContract } from './contract';
import { goplus } from '@/lib/api';

export interface AnalyzeTokenOptions {
  tokenAddress: string;
  chainId: ChainId;
  poolAddress?: string;
  liquidity?: number;
}

export async function analyzeToken(
  options: AnalyzeTokenOptions
): Promise<RiskScore> {
  const { tokenAddress, chainId, liquidity = 0 } = options;

  // Run all analyses in parallel
  const [honeypotRisk, holderRisk, contractRisk, security] = await Promise.all([
    detectHoneypot(chainId, tokenAddress),
    analyzeHolders(chainId, tokenAddress),
    analyzeContract(chainId, tokenAddress),
    goplus.getTokenSecurity(chainId, tokenAddress).catch(() => null),
  ]);

  // Analyze liquidity using GoPlus data
  const liquidityRisk = goplus.analyzeLiquidityRisk(security, liquidity);

  // Calculate total score (raw, can exceed 100)
  const rawScore =
    honeypotRisk.score +
    holderRisk.score +
    contractRisk.score +
    liquidityRisk.score;

  // Normalize to 0-100 scale
  // Max possible: 50 (honeypot) + 25 (holders) + 30 (contract) + 25 (liquidity) = 130
  const normalizedScore = Math.min(Math.round((rawScore / 130) * 100), 100);

  // Collect all warnings
  const allWarnings: RiskWarning[] = [
    ...honeypotRisk.warnings,
    ...holderRisk.warnings,
    ...contractRisk.warnings,
    ...liquidityRisk.warnings,
  ];

  // Sort warnings by severity
  const severityOrder: Record<RiskLevel, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  allWarnings.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  return {
    tokenAddress,
    chainId,
    totalScore: normalizedScore,
    level: getRiskLevel(normalizedScore),
    liquidity: liquidityRisk,
    holders: holderRisk,
    contract: contractRisk,
    honeypot: honeypotRisk,
    warnings: allWarnings,
    analyzedAt: new Date().toISOString(),
  };
}

export function formatRiskScore(score: number): string {
  if (score <= RISK_THRESHOLDS.low.max) return `${score} (Low Risk)`;
  if (score <= RISK_THRESHOLDS.medium.max) return `${score} (Medium Risk)`;
  if (score <= RISK_THRESHOLDS.high.max) return `${score} (High Risk)`;
  return `${score} (Critical Risk)`;
}

export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return '#00ff00'; // Green
    case 'medium':
      return '#ffff00'; // Yellow
    case 'high':
      return '#ff8800'; // Orange
    case 'critical':
      return '#ff0000'; // Red
  }
}

export function getRiskEmoji(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return '✓';
    case 'medium':
      return '⚠';
    case 'high':
      return '⚠';
    case 'critical':
      return '✗';
  }
}

export function summarizeRisk(risk: RiskScore): string {
  const critical = risk.warnings.filter((w) => w.severity === 'critical');
  const high = risk.warnings.filter((w) => w.severity === 'high');

  if (critical.length > 0) {
    return critical[0].message;
  }

  if (high.length > 0) {
    return high[0].message;
  }

  if (risk.warnings.length > 0) {
    return risk.warnings[0].message;
  }

  return 'No significant risks detected';
}

export function shouldWarn(risk: RiskScore): boolean {
  return (
    risk.level === 'critical' ||
    risk.level === 'high' ||
    risk.honeypot.isHoneypot ||
    risk.honeypot.cannotSell
  );
}

// Quick check for obvious red flags without full analysis
export async function quickRiskCheck(
  chainId: ChainId,
  tokenAddress: string
): Promise<{
  isHighRisk: boolean;
  reason?: string;
}> {
  try {
    const security = await goplus.getTokenSecurity(chainId, tokenAddress);

    if (!security) {
      return { isHighRisk: false };
    }

    // Check for immediate red flags
    if (security.is_honeypot === '1') {
      return { isHighRisk: true, reason: 'Honeypot detected' };
    }

    if (security.cannot_sell_all === '1') {
      return { isHighRisk: true, reason: 'Cannot sell tokens' };
    }

    const sellTax = parseFloat(security.sell_tax || '0') * 100;
    if (sellTax > 50) {
      return { isHighRisk: true, reason: `Sell tax: ${sellTax.toFixed(0)}%` };
    }

    if (security.owner_change_balance === '1') {
      return { isHighRisk: true, reason: 'Owner can modify balances' };
    }

    return { isHighRisk: false };
  } catch {
    return { isHighRisk: false };
  }
}
