import { NextRequest, NextResponse } from 'next/server';
import { ChainId } from '@/types/chain';
import { TokenWithMetrics } from '@/types/token';
import { getRiskLevel } from '@/types/risk';
import * as dexscreener from '@/lib/api/dexscreener';
import * as db from '@/lib/db/supabase';
import { calculateTrendingScores } from '@/lib/trending';

export const runtime = 'edge';
export const revalidate = 30;

// Cache freshness threshold (30 seconds)
const CACHE_TTL_MS = 30 * 1000;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chainId = searchParams.get('chain') as ChainId | null;
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  try {
    let tokens: TokenWithMetrics[] = [];
    let fromCache = false;

    // Try to get cached tokens from Supabase
    const cachedTokens = await db.getTopTokens(chainId || undefined, 'volume_24h', limit);

    // Check if cache is fresh (updated within last 30 seconds)
    if (cachedTokens.length > 0) {
      const newestUpdate = cachedTokens.reduce((latest, t) => {
        const updatedAt = new Date(t.metrics.updatedAt || 0).getTime();
        return updatedAt > latest ? updatedAt : latest;
      }, 0);

      const cacheAge = Date.now() - newestUpdate;
      if (cacheAge < CACHE_TTL_MS) {
        // Cache is fresh, use it
        tokens = cachedTokens.map((t) => ({
          ...t,
          risk: undefined, // Risk scores fetched separately
        }));
        fromCache = true;
      }
    }

    // Cache miss or stale - fetch fresh data
    if (!fromCache) {
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
      tokens = tokens.filter((t) => {
        const key = `${t.chainId}-${t.address.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Sort by volume
      tokens.sort((a, b) => b.metrics.volume24h - a.metrics.volume24h);
      tokens = tokens.slice(0, limit);

      // Cache tokens in Supabase (fire and forget)
      cacheTokens(tokens).catch((err) =>
        console.error('Failed to cache tokens:', err)
      );
    }

    // Calculate trending scores for all tokens
    tokens = calculateTrendingScores(tokens);

    return NextResponse.json({
      success: true,
      tokens,
      meta: {
        count: tokens.length,
        timestamp: new Date().toISOString(),
        fromCache,
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

// Cache tokens to Supabase
async function cacheTokens(tokens: TokenWithMetrics[]): Promise<void> {
  for (const token of tokens) {
    try {
      // Upsert token
      await db.upsertToken({
        address: token.address,
        chainId: token.chainId,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals || 18,
        logoUrl: token.logoUrl,
      });

      // Upsert metrics
      await db.upsertTokenMetrics(token.metrics);
    } catch (err) {
      // Continue with other tokens
      console.error(`Failed to cache token ${token.symbol}:`, err);
    }
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
      warnings:
        liquidity < 10000
          ? [
              {
                code: 'LOW_LIQ',
                severity: 'high' as const,
                message: `Low liquidity: $${liquidity.toLocaleString()}`,
              },
            ]
          : [],
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
    warnings:
      liquidity < 10000
        ? [
            {
              code: 'LOW_LIQ',
              severity: 'high' as const,
              message: `Low liquidity: $${liquidity.toLocaleString()}`,
            },
          ]
        : [],
    analyzedAt: new Date().toISOString(),
  };
}
