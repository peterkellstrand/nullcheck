import { NextResponse } from 'next/server';
import { ChainId } from '@/types/chain';

export const API_VERSION = '2024-01';
export const CACHE_MAX_AGE = 300; // 5 minutes

// Address validation patterns by chain
export const ADDRESS_PATTERNS: Record<ChainId, RegExp> = {
  ethereum: /^0x[a-fA-F0-9]{40}$/,
  base: /^0x[a-fA-F0-9]{40}$/,
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
};

// Generate unique request ID
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

// Generate ETag from data (uses simple hash for edge runtime compatibility)
export function generateETag(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `"${Math.abs(hash).toString(16)}"`;
}

// Standard CORS headers for agent access
export function getCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Request-ID, X-Idempotency-Key',
    'Access-Control-Expose-Headers': 'X-Request-ID, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, ETag, X-API-Version',
  };
}

// Create standardized error response
export function createErrorResponse(
  code: string,
  message: string,
  status: number,
  requestId: string,
  details?: Record<string, unknown>,
  rateLimitHeaders?: Record<string, string>
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
    },
    {
      status,
      headers: {
        ...getCorsHeaders(),
        ...rateLimitHeaders,
        'X-Request-ID': requestId,
        'X-API-Version': API_VERSION,
      },
    }
  );
}

// Create standardized success response
export function createSuccessResponse<T>(
  data: T,
  requestId: string,
  options?: {
    status?: number;
    cached?: boolean;
    etag?: string;
    rateLimitHeaders?: Record<string, string>;
    additionalHeaders?: Record<string, string>;
  }
): NextResponse {
  const { status = 200, cached, etag, rateLimitHeaders, additionalHeaders } = options || {};

  const headers: Record<string, string> = {
    ...getCorsHeaders(),
    ...rateLimitHeaders,
    ...additionalHeaders,
    'X-Request-ID': requestId,
    'X-API-Version': API_VERSION,
  };

  if (etag) {
    headers['ETag'] = etag;
    if (cached) {
      headers['Cache-Control'] = `public, max-age=${CACHE_MAX_AGE}`;
    }
  }

  return NextResponse.json(
    {
      success: true,
      data,
      ...(cached !== undefined && { cached }),
    },
    { status, headers }
  );
}

// Handle CORS preflight requests
export function handleCorsOptions(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

// Validate address format for a given chain
export function validateAddress(chainId: ChainId, address: string): boolean {
  return ADDRESS_PATTERNS[chainId]?.test(address) ?? false;
}

// Standard error codes
export const ERROR_CODES = {
  INVALID_CHAIN: 'INVALID_CHAIN',
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_KEY: 'INVALID_KEY',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;
