import { NextRequest, NextResponse } from 'next/server';
import { ChainId, CHAINS } from '@/types/chain';
import { TokenWithMetrics } from '@/types/token';
import { RiskLevel, getRiskLevel } from '@/types/risk';
import * as dexscreener from '@/lib/api/dexscreener';

export const runtime = 'edge';
export const revalidate = 30;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chainId = searchParams.get('chain') as ChainId | null;
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  try {
    let tokens: TokenWithMetrics[] = [];

    // Fetch from specified chain or all chains
    const chains = chainId ? [chainId] : (['ethereum', 'base', 'solana'] as ChainId[]);

    const pairPromises = chains.map(async (chain) => {
      try {
        // Get trending pairs
        const pairs = await dexscreener.getTrendingPairs(chain);

        // For Solana, also get boosted tokens (includes pump.fun graduates)
        let allPairs = pairs;
        if (chain === 'solana') {
          const boostedPairs = await dexscreener.getLatestBoostedTokens();
          allPairs = [...pairs, ...boostedPairs];
        }

        return allPairs.slice(0, Math.ceil(limit / chains.length)).map((pair) => {
          const riskScore = generatePlaceholderRiskScore(pair);

          return {
            address: pair.baseToken.address,
            chainId: chain,
            symbol: pair.baseToken.symbol,
            name: pair.baseToken.name,
            decimals: 18,
            logoUrl: pair.info?.imageUrl,
            metrics: {
              tokenAddress: pair.baseToken.address,
              chainId: chain,
              price: parseFloat(pair.priceUsd) || 0,
              priceChange1h: pair.priceChange?.h1 || 0,
              priceChange24h: pair.priceChange?.h24 || 0,
              priceChange7d: 0,
              volume24h: pair.volume?.h24 || 0,
              liquidity: pair.liquidity?.usd || 0,
              marketCap: pair.marketCap,
              fdv: pair.fdv,
              txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
              buys24h: pair.txns?.h24?.buys || 0,
              sells24h: pair.txns?.h24?.sells || 0,
              updatedAt: new Date().toISOString(),
            },
            risk: riskScore,
          } as TokenWithMetrics;
        });
      } catch (error) {
        console.error(`Failed to fetch pairs for ${chain}:`, error);
        return [];
      }
    });

    const results = await Promise.all(pairPromises);
    tokens = results.flat();

    // Dedupe by address (same token might appear on multiple DEXes)
    const seen = new Set<string>();
    tokens = tokens.filter(t => {
      const key = `${t.chainId}-${t.address.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by volume
    tokens.sort((a, b) => b.metrics.volume24h - a.metrics.volume24h);
    tokens = tokens.slice(0, limit);

    return NextResponse.json({
      success: true,
      tokens,
      meta: {
        count: tokens.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch tokens',
        tokens: [],
      },
      { status: 500 }
    );
  }
}

// Generate placeholder risk scores based on available data
// In production, this would call the actual risk analysis API
function generatePlaceholderRiskScore(pair: dexscreener.DexScreenerPair) {
  const liquidity = pair.liquidity?.usd || 0;
  const volume = pair.volume?.h24 || 0;
  const txns = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);

  // Simple heuristic scoring
  let score = 0;

  // Liquidity risk
  if (liquidity < 10000) score += 25;
  else if (liquidity < 50000) score += 15;
  else if (liquidity < 100000) score += 8;

  // Low activity might indicate issues
  if (txns < 50) score += 10;
  else if (txns < 200) score += 5;

  // Volume to liquidity ratio (too high might be wash trading)
  const vlRatio = volume / (liquidity || 1);
  if (vlRatio > 10) score += 10;

  // Random component for demo variety
  score += Math.floor(Math.random() * 15);

  score = Math.min(score, 100);
  const level = getRiskLevel(score);

  return {
    tokenAddress: pair.baseToken.address,
    chainId: pair.chainId as ChainId,
    totalScore: score,
    level,
    liquidity: {
      score: liquidity < 50000 ? 15 : liquidity < 100000 ? 8 : 2,
      liquidity,
      lpLocked: liquidity > 100000,
      lpLockedPercent: liquidity > 100000 ? 80 : 0,
      lpBurnedPercent: 0,
      warnings: liquidity < 10000 ? [{ code: 'LOW_LIQ', severity: 'high' as const, message: `Low liquidity: $${liquidity.toLocaleString()}` }] : [],
    },
    holders: {
      score: 5,
      totalHolders: txns * 10, // Rough estimate
      top10Percent: 30,
      top20Percent: 45,
      creatorHoldingPercent: 5,
      warnings: [],
    },
    contract: {
      score: 5,
      verified: true,
      renounced: false,
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
    warnings: liquidity < 10000 ? [{ code: 'LOW_LIQ', severity: 'high' as const, message: `Low liquidity: $${liquidity.toLocaleString()}` }] : [],
    analyzedAt: new Date().toISOString(),
  };
}
