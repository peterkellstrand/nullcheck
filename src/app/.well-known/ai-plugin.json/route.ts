import { NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/api/utils';

export const runtime = 'edge';

/**
 * GET /.well-known/ai-plugin.json
 *
 * AI plugin manifest for agent discovery.
 * Follows the convention established by OpenAI for ChatGPT plugins,
 * now widely adopted as a standard for AI agent tool discovery.
 */
export async function GET() {
  const manifest = {
    schema_version: '1.0.0',
    name_for_human: 'nullcheck',
    name_for_model: 'nullcheck_defi_risk',
    description_for_human:
      'Check if a DeFi token is a honeypot, rug pull, or scam before you trade. Risk analysis across Ethereum, Base, and Solana.',
    description_for_model:
      'Token risk analysis API for DeFi. Primary endpoint: POST /api/risk/{chain}/{address} returns a 0-100 risk score with breakdown (honeypot, contract, holders, liquidity). Score 0-14 = safe, 15-29 = some concerns, 30-49 = significant red flags, 50-100 = likely scam. Also provides trending tokens (GET /api/tokens), whale tracking (GET /api/whale/activity/{chain}/{address}), batch analysis (POST /api/risk/batch), and real-time webhooks. Supports Ethereum, Base, and Solana chains.',
    auth: {
      type: 'service_http',
      authorization_type: 'bearer',
      header: 'X-API-Key',
    },
    api: {
      type: 'openapi',
      url: 'https://api.nullcheck.io/api/openapi',
      is_user_facing: false,
    },
    logo_url: 'https://nullcheck.io/favicon.ico',
    contact_email: 'support@nullcheck.io',
    legal_info_url: 'https://nullcheck.io/methodology',
  };

  return NextResponse.json(manifest, {
    headers: {
      ...getCorsHeaders(),
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}
