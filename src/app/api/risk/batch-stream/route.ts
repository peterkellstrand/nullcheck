import { NextRequest } from 'next/server';
import { ChainId, CHAINS } from '@/types/chain';
import { RiskScore, getRiskLevel } from '@/types/risk';
import * as goplus from '@/lib/api/goplus';
import * as db from '@/lib/db/supabase';
import { verifyApiAccess } from '@/lib/auth/verify-api-access';
import { validateAddress, generateRequestId, getCorsHeaders, API_VERSION } from '@/lib/api/utils';

export const runtime = 'edge';

// Tier-based batch limits
const BATCH_LIMITS = {
  starter: 10,
  builder: 50,
  scale: 100,
} as const;

const ANALYSIS_TIMEOUT = 20000; // 20 seconds per token

interface TokenRequest {
  address: string;
  chainId: ChainId;
  liquidity?: number;
}

interface StreamMessage {
  type: 'progress' | 'result' | 'error' | 'done';
  token?: string;
  result?: RiskScore;
  cached?: boolean;
  error?: string;
  progress?: {
    processed: number;
    total: number;
    percent: number;
  };
  meta?: {
    succeeded: number;
    failed: number;
    cacheHits: number;
    processingTimeMs: number;
  };
}

function normalizeAddress(address: string, chainId: ChainId): string {
  return chainId === 'solana' ? address : address.toLowerCase();
}

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...getCorsHeaders(),
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Request-ID',
    },
  });
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('X-Request-ID') || generateRequestId();
  const startTime = Date.now();

  // Verify API access
  const access = await verifyApiAccess(request);

  if (access.type === 'error') {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: access.code, message: access.error },
      }),
      {
        status: access.code === 'RATE_LIMITED' ? 429 : 401,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(),
          'X-Request-ID': requestId,
        },
      }
    );
  }

  // Parse request
  const body = await request.json().catch(() => ({ tokens: [] }));
  let tokens: TokenRequest[] = body.tokens || [];

  if (tokens.length === 0) {
    return new Response(
      JSON.stringify({ success: true, data: { results: {}, meta: { requested: 0 } } }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(),
          'X-Request-ID': requestId,
        },
      }
    );
  }

  // Validate and normalize tokens
  const validTokens: TokenRequest[] = [];
  const validationErrors: Record<string, string> = {};

  for (const token of tokens) {
    const key = `${token.chainId}-${token.address}`;

    if (!(token.chainId in CHAINS)) {
      validationErrors[key] = `Invalid chain '${token.chainId}'`;
      continue;
    }

    if (!validateAddress(token.chainId, token.address)) {
      validationErrors[key] = `Invalid ${token.chainId} address format`;
      continue;
    }

    validTokens.push({
      ...token,
      address: normalizeAddress(token.address, token.chainId),
    });
  }

  // Deduplicate
  const uniqueTokens = Array.from(
    new Map(validTokens.map(t => [`${t.chainId}-${t.address}`, t])).values()
  );

  // Check batch limit
  let maxBatchSize: number = BATCH_LIMITS.starter;
  if (access.type === 'agent') {
    const tier = access.tier as keyof typeof BATCH_LIMITS;
    maxBatchSize = BATCH_LIMITS[tier] || BATCH_LIMITS.starter;
  } else if (access.type === 'human' && access.tier === 'pro') {
    maxBatchSize = BATCH_LIMITS.builder;
  }

  if (uniqueTokens.length > maxBatchSize) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'BATCH_SIZE_EXCEEDED',
          message: `Batch size ${uniqueTokens.length} exceeds tier limit of ${maxBatchSize}`,
        },
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(),
          'X-Request-ID': requestId,
        },
      }
    );
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  let succeeded = 0;
  let failed = 0;
  let cacheHits = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const sendMessage = (msg: StreamMessage) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
      };

      // Send validation errors first
      for (const [key, error] of Object.entries(validationErrors)) {
        sendMessage({
          type: 'error',
          token: key,
          error,
        });
        failed++;
      }

      // Process each token
      let processed = 0;

      for (const token of uniqueTokens) {
        const key = `${token.chainId}-${token.address}`;

        try {
          // Check cache first
          const cached = await db.getRiskScore(token.chainId, token.address);

          if (cached) {
            sendMessage({
              type: 'result',
              token: key,
              result: cached,
              cached: true,
              progress: {
                processed: ++processed,
                total: uniqueTokens.length,
                percent: Math.round((processed / uniqueTokens.length) * 100),
              },
            });
            succeeded++;
            cacheHits++;
            continue;
          }

          // Analyze with timeout
          const riskScore = await analyzeWithTimeout(
            token.chainId,
            token.address,
            token.liquidity || 0,
            ANALYSIS_TIMEOUT
          );

          if (riskScore) {
            // Cache result (fire and forget)
            db.upsertRiskScore(riskScore).catch(console.error);

            sendMessage({
              type: 'result',
              token: key,
              result: riskScore,
              cached: false,
              progress: {
                processed: ++processed,
                total: uniqueTokens.length,
                percent: Math.round((processed / uniqueTokens.length) * 100),
              },
            });
            succeeded++;
          } else {
            sendMessage({
              type: 'error',
              token: key,
              error: 'Analysis timed out',
              progress: {
                processed: ++processed,
                total: uniqueTokens.length,
                percent: Math.round((processed / uniqueTokens.length) * 100),
              },
            });
            failed++;
          }
        } catch (error) {
          sendMessage({
            type: 'error',
            token: key,
            error: error instanceof Error ? error.message : 'Unknown error',
            progress: {
              processed: ++processed,
              total: uniqueTokens.length,
              percent: Math.round((processed / uniqueTokens.length) * 100),
            },
          });
          failed++;
        }
      }

      // Send completion message
      sendMessage({
        type: 'done',
        meta: {
          succeeded,
          failed,
          cacheHits,
          processingTimeMs: Date.now() - startTime,
        },
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...getCorsHeaders(),
      'X-Request-ID': requestId,
      'X-API-Version': API_VERSION,
    },
  });
}

async function analyzeWithTimeout(
  chainId: ChainId,
  tokenAddress: string,
  liquidity: number,
  timeout: number
): Promise<RiskScore | null> {
  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), timeout)
  );

  const analysisPromise = analyzeTokenRisk(chainId, tokenAddress, liquidity);

  return Promise.race([analysisPromise, timeoutPromise]);
}

async function analyzeTokenRisk(
  chainId: ChainId,
  tokenAddress: string,
  liquidity: number
): Promise<RiskScore | null> {
  try {
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      return createSafeRiskScore(tokenAddress, chainId, liquidity);
    }

    const security = await goplus.getTokenSecurity(chainId, tokenAddress);

    if (!security) {
      return createUnknownRiskScore(tokenAddress, chainId, liquidity);
    }

    const honeypotRisk = goplus.analyzeHoneypotRisk(security);
    const contractRisk = goplus.analyzeContractRisk(security);
    const holderRisk = goplus.analyzeHolderRisk(security);
    const liquidityRisk = goplus.analyzeLiquidityRisk(security, liquidity);

    const rawScore =
      honeypotRisk.score + contractRisk.score + holderRisk.score + liquidityRisk.score;

    const totalScore = Math.min(Math.round((rawScore / 130) * 100), 100);
    const level = getRiskLevel(totalScore);

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
    console.error(`Analysis error for ${tokenAddress}:`, error);
    return createUnknownRiskScore(tokenAddress, chainId, liquidity);
  }
}

function createSafeRiskScore(tokenAddress: string, chainId: ChainId, liquidity: number): RiskScore {
  return {
    tokenAddress,
    chainId,
    totalScore: 0,
    level: 'low',
    liquidity: { score: 0, liquidity, lpLocked: true, lpLockedPercent: 100, lpBurnedPercent: 0, warnings: [] },
    holders: { score: 0, totalHolders: 0, top10Percent: 0, top20Percent: 0, creatorHoldingPercent: 0, warnings: [] },
    contract: { score: 0, verified: true, renounced: true, hasProxy: false, hasMintFunction: false, hasPauseFunction: false, hasBlacklistFunction: false, maxTaxPercent: 0, warnings: [] },
    honeypot: { score: 0, isHoneypot: false, buyTax: 0, sellTax: 0, transferTax: 0, cannotSell: false, cannotTransfer: false, warnings: [] },
    warnings: [],
    analyzedAt: new Date().toISOString(),
  };
}

function createUnknownRiskScore(tokenAddress: string, chainId: ChainId, liquidity: number): RiskScore {
  const lowLiqWarning = liquidity < 10000 ? [{ code: 'LOW_LIQ', severity: 'high' as const, message: `Low liquidity: $${liquidity.toLocaleString()}` }] : [];

  return {
    tokenAddress,
    chainId,
    totalScore: 25,
    level: 'medium',
    liquidity: { score: liquidity < 50000 ? 15 : 5, liquidity, lpLocked: false, lpLockedPercent: 0, lpBurnedPercent: 0, warnings: lowLiqWarning },
    holders: { score: 5, totalHolders: 0, top10Percent: 0, top20Percent: 0, creatorHoldingPercent: 0, warnings: [] },
    contract: { score: 10, verified: false, renounced: false, hasProxy: false, hasMintFunction: false, hasPauseFunction: false, hasBlacklistFunction: false, maxTaxPercent: 0, warnings: [{ code: 'UNVERIFIED', severity: 'medium', message: 'Unable to verify contract' }] },
    honeypot: { score: 5, isHoneypot: false, buyTax: 0, sellTax: 0, transferTax: 0, cannotSell: false, cannotTransfer: false, warnings: [{ code: 'UNKNOWN', severity: 'medium', message: 'Honeypot status unknown' }] },
    warnings: [{ code: 'UNVERIFIED', severity: 'medium', message: 'Unable to verify contract' }],
    analyzedAt: new Date().toISOString(),
  };
}
