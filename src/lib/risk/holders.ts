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

    return {
      score: Math.min(score, 25),
      totalHolders: topHolders.length,
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

