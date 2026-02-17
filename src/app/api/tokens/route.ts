import { NextRequest, NextResponse } from 'next/server';
import { ChainId, CHAINS } from '@/types/chain';
import { TokenWithMetrics } from '@/types/token';
import { getRiskLevel } from '@/types/risk';
import * as geckoterminal from '@/lib/api/geckoterminal';
import * as db from '@/lib/db/supabase';
import { calculateTrendingScores } from '@/lib/trending';
import {
  generateRequestId,
  generateETag,
  getCorsHeaders,
  createErrorResponse,
  handleCorsOptions,
  API_VERSION,
} from '@/lib/api/utils';

export const runtime = 'edge';
export const revalidate = 30;

export const OPTIONS = handleCorsOptions;

// Cache freshness threshold (30 seconds)
const CACHE_TTL_MS = 30 * 1000;

export async function GET(request: NextRequest) {
  const requestId = request.headers.get('X-Request-ID') || generateRequestId();
  const searchParams = request.nextUrl.searchParams;
  const chainId = searchParams.get('chain') as ChainId | null;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

  // Validate chain if provided
  if (chainId && !(chainId in CHAINS)) {
    return createErrorResponse(
      'INVALID_CHAIN',
      `Chain '${chainId}' is not supported. Valid chains: ${Object.keys(CHAINS).join(', ')}`,
      400,
      requestId
    );
  }

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

    // Cache miss or stale - fetch fresh data from GeckoTerminal trending
    if (!fromCache) {
      const chains = chainId ? [chainId] : (['ethereum', 'base', 'solana', 'arbitrum', 'polygon'] as ChainId[]);
      const tokensPerChain = Math.ceil((limit * 2) / chains.length);

      const trendingPromises = chains.map(async (chain) => {
        try {
          // Get actually trending tokens from GeckoTerminal
          const trendingTokens = await geckoterminal.getTrendingTokens(chain, tokensPerChain);

          // Add placeholder risk scores
          return trendingTokens.map((token) => ({
            ...token,
            risk: generatePlaceholderRiskScore(token),
          }));
        } catch (error) {
          console.error(`Failed to fetch trending for ${chain}:`, error);
          return [];
        }
      });

      const results = await Promise.all(trendingPromises);
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

    const etag = generateETag({ tokens: tokens.map(t => t.address), count: tokens.length });

    // Check If-None-Match for conditional GET
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ...getCorsHeaders(),
          'X-Request-ID': requestId,
          'X-API-Version': API_VERSION,
          ETag: etag,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          tokens,
          meta: {
            count: tokens.length,
            timestamp: new Date().toISOString(),
            fromCache,
          },
        },
      },
      {
        headers: {
          ...getCorsHeaders(),
          'X-Request-ID': requestId,
          'X-API-Version': API_VERSION,
          'Cache-Control': 'public, max-age=30',
          ETag: etag,
        },
      }
    );
  } catch (error) {
    console.error('API error:', error);
    return createErrorResponse(
      'INTERNAL_ERROR',
      'Failed to fetch tokens',
      500,
      requestId
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
function generatePlaceholderRiskScore(token: TokenWithMetrics) {
  const liquidity = token.metrics.liquidity || 0;
  const volume = token.metrics.volume24h || 0;
  const txns = token.metrics.txns24h || 0;

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
    tokenAddress: token.address,
    chainId: token.chainId,
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
