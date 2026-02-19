import { NextRequest, NextResponse } from 'next/server';
import { ChainId, CHAINS } from '@/types/chain';
import { getSupabaseServer, getSupabaseServerWithServiceRole } from '@/lib/db/supabase-server';
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

interface RouteParams {
  params: Promise<{
    chain: string;
    address: string;
  }>;
}

/**
 * GET /api/sentiment/{chain}/{address}
 * Get sentiment summary for a token
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId();
  const { chain, address } = await params;

  // Validate chain
  if (!(chain in CHAINS)) {
    return createErrorResponse(
      'INVALID_CHAIN',
      `Chain '${chain}' is not supported`,
      400,
      requestId
    );
  }

  const chainId = chain as ChainId;

  // Validate address
  if (!validateAddress(chainId, address)) {
    return createErrorResponse(
      'INVALID_ADDRESS',
      `Invalid ${chainId} address format`,
      400,
      requestId
    );
  }

  try {
    const supabase = await getSupabaseServerWithServiceRole();

    // Get sentiment summary
    const { data, error } = await supabase
      .from('token_sentiment_summary')
      .select('*')
      .eq('chain_id', chainId)
      .eq('token_address', address.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('Sentiment fetch error:', error);
      return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch sentiment', 500, requestId);
    }

    // Check if current user has voted
    const userSupabase = await getSupabaseServer();
    const { data: { user } } = await userSupabase.auth.getUser();

    let userVote: string | null = null;
    if (user) {
      const { data: voteData } = await supabase
        .from('token_sentiment')
        .select('vote')
        .eq('chain_id', chainId)
        .eq('token_address', address.toLowerCase())
        .eq('user_id', user.id)
        .single();

      userVote = voteData?.vote || null;
    }

    const sentiment = data || {
      bullish_count: 0,
      bearish_count: 0,
      total_votes: 0,
      bullish_percent: 0,
    };

    return NextResponse.json(
      {
        success: true,
        data: {
          bullishCount: sentiment.bullish_count,
          bearishCount: sentiment.bearish_count,
          totalVotes: sentiment.total_votes,
          bullishPercent: sentiment.bullish_percent || 0,
          userVote,
        },
      },
      {
        headers: {
          ...getCorsHeaders(),
          'X-Request-ID': requestId,
          'X-API-Version': API_VERSION,
          'Cache-Control': 'public, max-age=30',
        },
      }
    );
  } catch (error) {
    console.error('Sentiment error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch sentiment', 500, requestId);
  }
}

/**
 * POST /api/sentiment/{chain}/{address}
 * Vote on a token's sentiment
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId();
  const { chain, address } = await params;

  // Validate chain
  if (!(chain in CHAINS)) {
    return createErrorResponse(
      'INVALID_CHAIN',
      `Chain '${chain}' is not supported`,
      400,
      requestId
    );
  }

  const chainId = chain as ChainId;

  // Validate address
  if (!validateAddress(chainId, address)) {
    return createErrorResponse(
      'INVALID_ADDRESS',
      `Invalid ${chainId} address format`,
      400,
      requestId
    );
  }

  try {
    const body = await request.json();
    const { vote, fingerprint } = body;

    if (!vote || !['bullish', 'bearish'].includes(vote)) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Vote must be "bullish" or "bearish"',
        400,
        requestId
      );
    }

    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    const serviceSupabase = await getSupabaseServerWithServiceRole();
    const normalizedAddress = address.toLowerCase();

    if (user) {
      // Logged in user - upsert by user_id
      const { error } = await serviceSupabase
        .from('token_sentiment')
        .upsert(
          {
            token_address: normalizedAddress,
            chain_id: chainId,
            user_id: user.id,
            vote,
          },
          { onConflict: 'token_address,chain_id,user_id' }
        );

      if (error) {
        console.error('Vote error:', error);
        return createErrorResponse('INTERNAL_ERROR', 'Failed to record vote', 500, requestId);
      }
    } else if (fingerprint) {
      // Anonymous user - upsert by fingerprint
      const { error } = await serviceSupabase
        .from('token_sentiment')
        .upsert(
          {
            token_address: normalizedAddress,
            chain_id: chainId,
            fingerprint,
            vote,
          },
          { onConflict: 'token_address,chain_id,fingerprint' }
        );

      if (error) {
        console.error('Vote error:', error);
        return createErrorResponse('INTERNAL_ERROR', 'Failed to record vote', 500, requestId);
      }
    } else {
      return createErrorResponse(
        'UNAUTHORIZED',
        'Login required or provide fingerprint for anonymous voting',
        401,
        requestId
      );
    }

    // Return updated sentiment
    const { data: sentiment } = await serviceSupabase
      .from('token_sentiment_summary')
      .select('*')
      .eq('chain_id', chainId)
      .eq('token_address', normalizedAddress)
      .single();

    return NextResponse.json(
      {
        success: true,
        data: {
          bullishCount: sentiment?.bullish_count || 0,
          bearishCount: sentiment?.bearish_count || 0,
          totalVotes: sentiment?.total_votes || 0,
          bullishPercent: sentiment?.bullish_percent || 0,
          userVote: vote,
        },
      },
      {
        headers: {
          ...getCorsHeaders(),
          'X-Request-ID': requestId,
          'X-API-Version': API_VERSION,
        },
      }
    );
  } catch (error) {
    console.error('Vote error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to record vote', 500, requestId);
  }
}
