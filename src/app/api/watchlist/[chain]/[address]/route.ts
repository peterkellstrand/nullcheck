import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/db/supabase-server';
import { removeFromWatchlist } from '@/lib/db/watchlist';
import { ChainId } from '@/types/chain';

// DELETE - Remove token from watchlist
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ chain: string; address: string }> }
) {
  const { chain, address } = await params;
  const chainId = chain as ChainId;

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

  const result = await removeFromWatchlist(supabase, user.id, chainId, address);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
