import { NextRequest, NextResponse } from 'next/server';
import { ChainId, CHAINS } from '@/types/chain';
import { RiskScore, getRiskLevel } from '@/types/risk';
import * as goplus from '@/lib/api/goplus';
import * as db from '@/lib/db/supabase';
import { verifyApiAccess, createRateLimitHeaders } from '@/lib/auth/verify-api-access';
import {
  generateRequestId,
  getCorsHeaders,
  createErrorResponse,
  validateAddress,
  handleCorsOptions,
  API_VERSION,
} from '@/lib/api/utils';

export const runtime = 'edge';

export const OPTIONS = handleCorsOptions;

// Tier-based batch limits
const BATCH_LIMITS = {
  developer: 10,
  professional: 50,
  business: 100,
} as const;

const MAX_REQUEST_SIZE = 100 * 1024; // 100KB
const ANALYSIS_TIMEOUT = 25000; // 25 seconds (leave buffer for Vercel Edge 30s limit)
const CONCURRENCY = 5; // Process 5 tokens at a time

// In-flight request deduplication (prevents cache stampede)
const inflightRequests = new Map<string, Promise<RiskScore | null>>();

// Batch result cache (1 minute TTL)
const batchCache = new Map<string, { results: unknown; timestamp: number }>();
const BATCH_CACHE_TTL = 60000;

interface TokenRequest {
  address: string;
  chainId: ChainId;
  liquidity?: number;
}

// Normalize address based on chain (EVM = lowercase, Solana = case-sensitive)
function normalizeAddress(address: string, chainId: ChainId): string {
  return chainId === 'solana' ? address : address.toLowerCase();
}

// Process items in batches with concurrency control
async function processBatchWithConcurrency<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  concurrency: number = 5
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.all(batch.map(processor));
  }
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('X-Request-ID') || generateRequestId();
  const startTime = Date.now();

  // Validate request size
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
    return createErrorResponse(
      'REQUEST_TOO_LARGE',
      `Request body exceeds maximum size of ${MAX_REQUEST_SIZE} bytes`,
      413,
      requestId,
      { maxSize: MAX_REQUEST_SIZE }
    );
  }

  // Verify API access (handles both human sessions and API keys)
  const access = await verifyApiAccess(request);
  const rateLimitHeaders = createRateLimitHeaders(access);

  if (access.type === 'error') {
    return createErrorResponse(
      access.code,
      access.error,
      access.code === 'RATE_LIMITED' ? 429 : 401,
      requestId,
      undefined,
      rateLimitHeaders
    );
  }

  // Parse request body
  const body = await request.json().catch(() => ({ tokens: [] }));
  let tokens: TokenRequest[] = body.tokens || [];

  if (tokens.length === 0) {
    return NextResponse.json(
      {
        success: true,
        data: {
          results: {},
          meta: {
            requested: 0,
            succeeded: 0,
            failed: 0,
            cacheHits: 0,
          },
        },
      },
      {
        headers: {
          ...getCorsHeaders(),
          ...rateLimitHeaders,
          'X-Request-ID': requestId,
          'X-API-Version': API_VERSION,
        },
      }
    );
  }

  // Validate all tokens first
  const validationErrors: Record<string, { error: string; code: string }> = {};

  for (const token of tokens) {
    const key = `${token.chainId}-${token.address}`;

    if (!(token.chainId in CHAINS)) {
      validationErrors[key] = {
        error: `Invalid chain '${token.chainId}'`,
        code: 'INVALID_CHAIN',
      };
      continue;
    }

    if (!validateAddress(token.chainId, token.address)) {
      validationErrors[key] = {
        error: `Invalid ${token.chainId} address format`,
        code: 'INVALID_ADDRESS',
      };
    }
  }

  // Filter out invalid tokens
  tokens = tokens.filter(t => !validationErrors[`${t.chainId}-${t.address}`]);

  // Normalize addresses
  tokens = tokens.map(token => ({
    ...token,
    address: normalizeAddress(token.address, token.chainId),
  }));

  // Deduplicate tokens
  const uniqueTokens = Array.from(
    new Map(tokens.map(t => [`${t.chainId}-${t.address}`, t])).values()
  );

  // Determine batch limit based on access type
  let maxBatchSize: number = BATCH_LIMITS.developer;

  if (access.type === 'agent') {
    const tier = access.tier as keyof typeof BATCH_LIMITS;
    maxBatchSize = BATCH_LIMITS[tier] || BATCH_LIMITS.developer;
  } else if (access.type === 'human' && access.tier === 'pro') {
    maxBatchSize = BATCH_LIMITS.professional; // PRO users get professional-level batch size
  }

  if (uniqueTokens.length > maxBatchSize) {
    return createErrorResponse(
      'BATCH_SIZE_EXCEEDED',
      `Batch size ${uniqueTokens.length} exceeds your tier limit of ${maxBatchSize}`,
      400,
      requestId,
      {
        requested: uniqueTokens.length,
        maxBatchSize,
        tier: access.type === 'agent' ? access.tier : access.tier,
      },
      rateLimitHeaders
    );
  }

  // Check batch cache
  const cacheKey = uniqueTokens
    .map(t => `${t.chainId}-${t.address}`)
    .sort()
    .join('|');

  const batchCached = batchCache.get(cacheKey);
  if (batchCached && Date.now() - batchCached.timestamp < BATCH_CACHE_TTL) {
    const cachedResponse = batchCached.results as {
      success: boolean;
      data: { results: Record<string, RiskScore>; meta: Record<string, unknown> };
    };

    return NextResponse.json(
      {
        ...cachedResponse,
        data: {
          ...cachedResponse.data,
          meta: {
            ...cachedResponse.data.meta,
            batchCached: true,
          },
        },
      },
      {
        headers: {
          ...getCorsHeaders(),
          ...rateLimitHeaders,
          'X-Request-ID': requestId,
          'X-API-Version': API_VERSION,
          'X-Cache': 'HIT',
        },
      }
    );
  }

  // Process tokens with concurrency control
  const results: Record<string, RiskScore> = {};
  const errors: Record<string, { error: string; code: string }> = { ...validationErrors };
  let cacheHits = 0;

  await processBatchWithConcurrency(
    uniqueTokens,
    async (token) => {
      const key = `${token.chainId}-${token.address}`;

      try {
        // Check DB cache first
        const cached = await db.getRiskScore(token.chainId, token.address);
        if (cached) {
          results[key] = cached;
          cacheHits++;
          return;
        }

        // Analyze with deduplication and timeout
        const riskScore = await analyzeTokenWithDedup(
          token.chainId,
          token.address,
          token.liquidity || 0
        );

        if (riskScore) {
          results[key] = riskScore;
          // Cache to DB (fire and forget)
          db.upsertRiskScore(riskScore).catch(console.error);
        } else {
          errors[key] = {
            error: 'Analysis timed out or returned null',
            code: 'ANALYSIS_TIMEOUT',
          };
        }
      } catch (error) {
        console.error(`[${requestId}] Risk analysis failed for ${key}:`, error);
        errors[key] = {
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'ANALYSIS_EXCEPTION',
        };
      }
    },
    CONCURRENCY
  );

  const processingTimeMs = Date.now() - startTime;

  const response = {
    success: Object.keys(results).length > 0,
    data: {
      results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      meta: {
        requested: body.tokens?.length || 0,
        unique: uniqueTokens.length,
        succeeded: Object.keys(results).length,
        failed: Object.keys(errors).length,
        cacheHits,
        cacheMisses: Object.keys(results).length - cacheHits,
        processingTimeMs,
      },
    },
  };

  // Cache successful batch (only if no errors)
  if (Object.keys(errors).length === 0 && Object.keys(results).length > 0) {
    batchCache.set(cacheKey, {
      results: response,
      timestamp: Date.now(),
    });
  }

  return NextResponse.json(response, {
    headers: {
      ...getCorsHeaders(),
      ...rateLimitHeaders,
      'X-Request-ID': requestId,
      'X-API-Version': API_VERSION,
      'X-Processing-Time': processingTimeMs.toString(),
    },
  });
}

// Analyze token with request deduplication and timeout
async function analyzeTokenWithDedup(
  chainId: ChainId,
  tokenAddress: string,
  liquidity: number
): Promise<RiskScore | null> {
  const cacheKey = `${chainId}-${tokenAddress}`;

  // Check for in-flight request (prevents cache stampede)
  const existing = inflightRequests.get(cacheKey);
  if (existing) {
    return existing;
  }

  // Create analysis promise with timeout
  const analysisPromise = (async () => {
    try {
      // Race analysis against timeout
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), ANALYSIS_TIMEOUT)
      );

      const analysisResult = analyzeTokenRisk(chainId, tokenAddress, liquidity);
      const result = await Promise.race([analysisResult, timeoutPromise]);

      if (!result) {
        console.warn(`Analysis timeout for ${tokenAddress} on ${chainId}`);
      }

      return result;
    } finally {
      // Always clean up in-flight cache
      inflightRequests.delete(cacheKey);
    }
  })();

  // Store in in-flight cache
  inflightRequests.set(cacheKey, analysisPromise);

  return analysisPromise;
}

// Actual token risk analysis
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
