import { NextRequest, NextResponse } from 'next/server';
import { ChainId, CHAINS } from '@/types/chain';
import { getWhaleActivity } from '@/lib/api/whale';

interface RouteParams {
  params: Promise<{
    chain: string;
    address: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { chain, address } = await params;

  // Validate chain
  if (!(chain in CHAINS)) {
    return NextResponse.json(
      { success: false, error: 'Invalid chain' },
      { status: 400 }
    );
  }

  const chainId = chain as ChainId;

  try {
    const activity = await getWhaleActivity(chainId, address);

    return NextResponse.json({
      success: true,
      activity,
    });
  } catch (error) {
    console.error('Error fetching whale activity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch whale activity' },
      { status: 500 }
    );
  }
}
