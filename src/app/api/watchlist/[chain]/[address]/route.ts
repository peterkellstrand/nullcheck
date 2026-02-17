import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/db/supabase-server';
import { removeFromWatchlist } from '@/lib/db/watchlist';
import { validateCsrfToken, createCsrfErrorResponse } from '@/lib/auth/csrf';
import { ChainId } from '@/types/chain';

// DELETE - Remove token from watchlist
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ chain: string; address: string }> }
) {
  // Validate CSRF token for session-based requests
  if (!(await validateCsrfToken(request))) {
    return createCsrfErrorResponse();
  }

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
