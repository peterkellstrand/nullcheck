import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer, getSupabaseServerWithServiceRole } from '@/lib/db/supabase-server';
import { getUserSubscription } from '@/lib/db/subscription';
import { validateCsrfToken, createCsrfErrorResponse } from '@/lib/auth/csrf';
import { TIER_LIMITS } from '@/types/subscription';
import { CreateAlertRequest, PriceAlertRow, toAlert } from '@/types/alert';

// GET - Fetch user's alerts
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

  try {
    const { data: rows, error } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch alerts:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch alerts' },
        { status: 500 }
      );
    }

    const alerts = (rows as PriceAlertRow[]).map(toAlert);

    return NextResponse.json({
      success: true,
      data: { alerts },
    });
  } catch (err) {
    console.error('Alerts fetch error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new alert
export async function POST(request: NextRequest) {
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
    const body = (await request.json()) as CreateAlertRequest;
    const { chainId, tokenAddress, tokenSymbol, tokenName, alertType, targetPrice, currentPrice } = body;

    // Validate required fields
    if (!chainId || !tokenAddress || !tokenSymbol || !alertType || targetPrice === undefined || currentPrice === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate alert type
    if (alertType !== 'price_above' && alertType !== 'price_below') {
      return NextResponse.json(
        { success: false, error: 'Invalid alert type' },
        { status: 400 }
      );
    }

    // Validate target price makes sense
    if (alertType === 'price_above' && targetPrice <= currentPrice) {
      return NextResponse.json(
        { success: false, error: 'Target price must be above current price for price_above alerts' },
        { status: 400 }
      );
    }
    if (alertType === 'price_below' && targetPrice >= currentPrice) {
      return NextResponse.json(
        { success: false, error: 'Target price must be below current price for price_below alerts' },
        { status: 400 }
      );
    }

    // Check subscription limits
    const serviceSupabase = await getSupabaseServerWithServiceRole();
    const subscription = await getUserSubscription(serviceSupabase, user.id);
    const tier = subscription?.tier === 'pro' && subscription?.status === 'active' ? 'pro' : 'free';
    const limit = TIER_LIMITS[tier].alerts;

    // Count existing active alerts
    const { count, error: countError } = await supabase
      .from('price_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_triggered', false);

    if (countError) {
      console.error('Failed to count alerts:', countError);
      return NextResponse.json(
        { success: false, error: 'Failed to check alert limit' },
        { status: 500 }
      );
    }

    if ((count || 0) >= limit) {
      return NextResponse.json(
        { success: false, error: 'LIMIT_REACHED', limit },
        { status: 403 }
      );
    }

    // Normalize address for EVM chains
    const normalizedAddress = chainId === 'solana' ? tokenAddress : tokenAddress.toLowerCase();

    // Create the alert
    const { data: newAlert, error: insertError } = await supabase
      .from('price_alerts')
      .insert({
        user_id: user.id,
        chain_id: chainId,
        token_address: normalizedAddress,
        token_symbol: tokenSymbol,
        token_name: tokenName || null,
        alert_type: alertType,
        target_price: targetPrice,
        created_price: currentPrice,
      })
      .select()
      .single();

    if (insertError) {
      // Check for duplicate
      if (insertError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Alert already exists for this condition' },
          { status: 409 }
        );
      }
      console.error('Failed to create alert:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to create alert' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { alert: toAlert(newAlert as PriceAlertRow) },
    });
  } catch (err) {
    console.error('Alert creation error:', err);
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
