import { NextRequest, NextResponse } from 'next/server';
import { ChainId } from '@/types/chain';
import { RiskScore, getRiskLevel } from '@/types/risk';
import * as goplus from '@/lib/api/goplus';
import * as db from '@/lib/db/supabase';

export const runtime = 'edge';

interface TokenRequest {
  address: string;
  chainId: ChainId;
  liquidity?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tokens: TokenRequest[] = body.tokens || [];

    if (tokens.length === 0) {
      return NextResponse.json({ success: true, results: {} });
    }

    // Limit to 10 tokens per request to avoid timeout
    const tokensToAnalyze = tokens.slice(0, 10);

    // Fetch risk scores - check cache first, then analyze if needed
    const results: Record<string, RiskScore> = {};
    let cacheHits = 0;

    await Promise.all(
      tokensToAnalyze.map(async (token) => {
        try {
          const key = `${token.chainId}-${token.address.toLowerCase()}`;

          // Check cache first
          const cached = await db.getRiskScore(token.chainId, token.address);
          if (cached) {
            results[key] = cached;
            cacheHits++;
            return;
          }

          // Cache miss - analyze token
          const riskScore = await analyzeTokenRisk(
            token.chainId,
            token.address,
            token.liquidity || 0
          );

          if (riskScore) {
            results[key] = riskScore;

            // Save to cache (fire and forget)
            db.upsertRiskScore(riskScore).catch((err) =>
              console.error('Failed to cache risk score:', err)
            );
          }
        } catch (error) {
          console.error(`Risk analysis failed for ${token.address}:`, error);
        }
      })
    );

    return NextResponse.json({
      success: true,
      results,
      meta: {
        requested: tokens.length,
        analyzed: Object.keys(results).length,
        cacheHits,
      },
    });
  } catch (error) {
    console.error('Batch risk API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to analyze tokens', results: {} },
      { status: 500 }
    );
  }
}

async function analyzeTokenRisk(
  chainId: ChainId,
  tokenAddress: string,
  liquidity: number
): Promise<RiskScore | null> {
  try {
    // Skip native tokens (zero address)
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      return createSafeRiskScore(tokenAddress, chainId, liquidity);
    }

    const security = await goplus.getTokenSecurity(chainId, tokenAddress);

    if (!security) {
      return createUnknownRiskScore(tokenAddress, chainId, liquidity);
    }

    // Analyze each risk category
    const honeypotRisk = goplus.analyzeHoneypotRisk(security);
    const contractRisk = goplus.analyzeContractRisk(security);
    const holderRisk = goplus.analyzeHolderRisk(security);
    const liquidityRisk = goplus.analyzeLiquidityRisk(security, liquidity);

    // Calculate total score
    const rawScore =
      honeypotRisk.score +
      contractRisk.score +
      holderRisk.score +
      liquidityRisk.score;

    // Normalize to 0-100
    const totalScore = Math.min(Math.round((rawScore / 130) * 100), 100);
    const level = getRiskLevel(totalScore);

    // Collect all warnings
    const warnings = [
      ...honeypotRisk.warnings,
      ...contractRisk.warnings,
      ...holderRisk.warnings,
      ...liquidityRisk.warnings,
    ].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    });

    return {
      tokenAddress,
      chainId,
      totalScore,
      level,
      liquidity: liquidityRisk,
      holders: holderRisk,
      contract: contractRisk,
      honeypot: honeypotRisk,
      warnings,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`GoPlus analysis error for ${tokenAddress}:`, error);
    return createUnknownRiskScore(tokenAddress, chainId, liquidity);
  }
}

function createSafeRiskScore(
  tokenAddress: string,
  chainId: ChainId,
  liquidity: number
): RiskScore {
  return {
    tokenAddress,
    chainId,
    totalScore: 0,
    level: 'low',
    liquidity: {
      score: 0,
      liquidity,
      lpLocked: true,
      lpLockedPercent: 100,
      lpBurnedPercent: 0,
      warnings: [],
    },
    holders: {
      score: 0,
      totalHolders: 0,
      top10Percent: 0,
      top20Percent: 0,
      creatorHoldingPercent: 0,
      warnings: [],
    },
    contract: {
      score: 0,
      verified: true,
      renounced: true,
      hasProxy: false,
      hasMintFunction: false,
      hasPauseFunction: false,
      hasBlacklistFunction: false,
      maxTaxPercent: 0,
      warnings: [],
    },
    honeypot: {
      score: 0,
      isHoneypot: false,
      buyTax: 0,
      sellTax: 0,
      transferTax: 0,
      cannotSell: false,
      cannotTransfer: false,
      warnings: [],
    },
    warnings: [],
    analyzedAt: new Date().toISOString(),
  };
}

function createUnknownRiskScore(
  tokenAddress: string,
  chainId: ChainId,
  liquidity: number
): RiskScore {
  return {
    tokenAddress,
    chainId,
    totalScore: 25,
    level: 'medium',
    liquidity: {
      score: liquidity < 50000 ? 15 : 5,
      liquidity,
      lpLocked: false,
      lpLockedPercent: 0,
      lpBurnedPercent: 0,
      warnings:
        liquidity < 10000
          ? [
              {
                code: 'LOW_LIQ',
                severity: 'high',
                message: `Low liquidity: $${liquidity.toLocaleString()}`,
              },
            ]
          : [],
    },
    holders: {
      score: 5,
      totalHolders: 0,
      top10Percent: 0,
      top20Percent: 0,
      creatorHoldingPercent: 0,
      warnings: [],
    },
    contract: {
      score: 10,
      verified: false,
      renounced: false,
      hasProxy: false,
      hasMintFunction: false,
      hasPauseFunction: false,
      hasBlacklistFunction: false,
      maxTaxPercent: 0,
      warnings: [
        {
          code: 'UNVERIFIED',
          severity: 'medium',
          message: 'Unable to verify contract',
        },
      ],
    },
    honeypot: {
      score: 5,
      isHoneypot: false,
      buyTax: 0,
      sellTax: 0,
      transferTax: 0,
      cannotSell: false,
      cannotTransfer: false,
      warnings: [
        {
          code: 'UNKNOWN',
          severity: 'medium',
          message: 'Honeypot status unknown',
        },
      ],
    },
    warnings: [
      {
        code: 'UNVERIFIED',
        severity: 'medium',
        message: 'Unable to verify contract',
      },
    ],
    analyzedAt: new Date().toISOString(),
  };
}
