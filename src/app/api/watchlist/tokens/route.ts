import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/db/supabase-server';
import { getWatchlistWithTokens } from '@/lib/db/watchlist';

// GET - Fetch user's watchlist with full token data
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

  const tokens = await getWatchlistWithTokens(supabase, user.id);

  return NextResponse.json({
    success: true,
    tokens,
  });
}
