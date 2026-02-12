import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/db/supabase-server';
import { getWatchedTokenKeys, addToWatchlist } from '@/lib/db/watchlist';
import { ChainId } from '@/types/chain';

// GET - Fetch user's watchlist token keys
export async function GET() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const keys = await getWatchedTokenKeys(supabase, user.id);

  return NextResponse.json({
    success: true,
    keys,
  });
}

// POST - Add token to watchlist
export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { chainId, address } = body as { chainId: ChainId; address: string };

    if (!chainId || !address) {
      return NextResponse.json(
        { success: false, error: 'Missing chainId or address' },
        { status: 400 }
      );
    }

    const result = await addToWatchlist(supabase, user.id, chainId, address);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
