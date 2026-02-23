import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/db/supabase-server';
import { validateCsrfToken, createCsrfErrorResponse } from '@/lib/auth/csrf';
import { PriceAlertRow, toAlert } from '@/types/alert';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Fetch single alert
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

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
    const { data: row, error } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !row) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { alert: toAlert(row as PriceAlertRow) },
    });
  } catch (err) {
    console.error('Alert fetch error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Remove an alert
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // Validate CSRF token
  if (!(await validateCsrfToken(request))) {
    return createCsrfErrorResponse();
  }

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
    const { error } = await supabase
      .from('price_alerts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to delete alert:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete alert' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Alert delete error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
