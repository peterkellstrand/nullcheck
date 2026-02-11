import { ChainId } from '@/types/chain';
import { HolderRisk, RiskWarning } from '@/types/risk';
import { goplus, helius } from '@/lib/api';

export async function analyzeHolders(
  chainId: ChainId,
  tokenAddress: string
): Promise<HolderRisk> {
  try {
    if (chainId === 'solana') {
      return analyzeSolanaHolders(tokenAddress);
    }

    return analyzeEvmHolders(chainId, tokenAddress);
  } catch (error) {
    console.error('Holder analysis error:', error);
    return {
      score: 10,
      totalHolders: 0,
      top10Percent: 0,
      top20Percent: 0,
      creatorHoldingPercent: 0,
      warnings: [
        {
          code: 'ANALYSIS_FAILED',
          severity: 'medium',
          message: 'Holder analysis unavailable',
        },
      ],
    };
  }
}

async function analyzeEvmHolders(
  chainId: Exclude<ChainId, 'solana'>,
  tokenAddress: string
): Promise<HolderRisk> {
  const security = await goplus.getTokenSecurity(chainId, tokenAddress);
  return goplus.analyzeHolderRisk(security);
}

async function analyzeSolanaHolders(tokenAddress: string): Promise<HolderRisk> {
  const warnings: RiskWarning[] = [];
  let score = 0;

  try {
    const topHolders = await helius.getTopHolders(tokenAddress, 20);
    const holderCount = await helius.getTokenHolderCount(tokenAddress);

    const analysis = helius.analyzeHolderDistribution(topHolders);
    warnings.push(...analysis.warnings);

    // Calculate score based on concentration
    if (analysis.top10Percent > 80) {
      score += 20;
    } else if (analysis.top10Percent > 60) {
      score += 15;
    } else if (analysis.top10Percent > 40) {
      score += 10;
    } else if (analysis.top10Percent > 20) {
      score += 5;
    }

    // Low holder count penalty
    if (holderCount < 50) {
      score += 10;
      warnings.push({
        code: 'FEW_HOLDERS',
        severity: 'high',
        message: `Only ${holderCount} holders`,
      });
    } else if (holderCount < 200) {
      score += 5;
      warnings.push({
        code: 'LOW_HOLDERS',
        severity: 'medium',
        message: `${holderCount} holders`,
      });
    }

    return {
      score: Math.min(score, 25),
      totalHolders: holderCount,
      top10Percent: analysis.top10Percent,
      top20Percent: analysis.top20Percent,
      creatorHoldingPercent: topHolders[0]?.percent || 0,
      warnings,
    };
  } catch {
    return {
      score: 10,
      totalHolders: 0,
      top10Percent: 0,
      top20Percent: 0,
      creatorHoldingPercent: 0,
      warnings: [
        {
          code: 'SOLANA_API_ERROR',
          severity: 'medium',
          message: 'Solana holder data unavailable',
        },
      ],
    };
  }
}

export function calculateConcentrationRisk(
  top10Percent: number,
  top20Percent: number,
  creatorPercent: number
): {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  message: string;
} {
  let score = 0;
  let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
  let message = 'Healthy holder distribution';

  if (top10Percent > 80) {
    score = 25;
    level = 'critical';
    message = 'Extremely concentrated - rug risk';
  } else if (top10Percent > 60) {
    score = 18;
    level = 'high';
    message = 'Highly concentrated holdings';
  } else if (top10Percent > 40) {
    score = 12;
    level = 'medium';
    message = 'Moderately concentrated';
  } else if (top10Percent > 20) {
    score = 6;
    level = 'low';
    message = 'Good distribution';
  }

  // Additional penalty for creator holding
  if (creatorPercent > 20) {
    score = Math.min(score + 5, 25);
    if (level !== 'critical') {
      message += ` (creator holds ${creatorPercent.toFixed(1)}%)`;
    }
  }

  return { score, level, message };
}
