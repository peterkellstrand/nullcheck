import { NextRequest, NextResponse } from 'next/server';
import { ChainId, CHAINS } from '@/types/chain';
import { analyzeToken } from '@/lib/risk/analyzer';
import { getRiskScore, upsertRiskScore } from '@/lib/db/supabase';

export const runtime = 'edge';

interface RouteParams {
  params: Promise<{
    chain: string;
    address: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { chain, address } = await params;

  if (!CHAINS[chain as ChainId]) {
    return NextResponse.json(
      { success: false, error: 'Invalid chain' },
      { status: 400 }
    );
  }

  const chainId = chain as ChainId;

  try {
    // Check cache first
    const cached = await getRiskScore(chainId, address).catch(() => null);

    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    // Return 404 if not cached and this is a GET request
    return NextResponse.json(
      { success: false, error: 'Risk score not found. Use POST to analyze.' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Risk fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch risk score' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { chain, address } = await params;

  if (!CHAINS[chain as ChainId]) {
    return NextResponse.json(
      { success: false, error: 'Invalid chain' },
      { status: 400 }
    );
  }

  const chainId = chain as ChainId;

  try {
    const body = await request.json().catch(() => ({}));
    const liquidity = body.liquidity || 0;

    // Perform fresh analysis
    const riskScore = await analyzeToken({
      tokenAddress: address,
      chainId,
      liquidity,
    });

    // Cache the result (ignore errors)
    upsertRiskScore(riskScore).catch(console.error);

    return NextResponse.json({
      success: true,
      data: riskScore,
      cached: false,
    });
  } catch (error) {
    console.error('Risk analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to analyze token' },
      { status: 500 }
    );
  }
}
