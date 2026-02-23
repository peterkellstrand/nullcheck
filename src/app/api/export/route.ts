import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer, getSupabaseServerWithServiceRole } from '@/lib/db/supabase-server';
import { getUserSubscription } from '@/lib/db/subscription';
import { TIER_LIMITS } from '@/types/subscription';

type ExportType = 'watchlist' | 'tokens';
type ExportFormat = 'csv' | 'json';

interface WatchlistToken {
  chain_id: string;
  token_address: string;
  symbol?: string;
  name?: string;
  price?: number;
  price_change_24h?: number;
  volume_24h?: number;
  liquidity?: number;
  market_cap?: number;
  risk_score?: number;
}

function formatCSV(data: Record<string, unknown>[], headers: string[]): string {
  const rows = [headers.join(',')];

  for (const item of data) {
    const row = headers.map((h) => {
      const value = item[h];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value);
    });
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

export async function GET(request: NextRequest) {
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

  // Check PRO subscription
  const serviceSupabase = await getSupabaseServerWithServiceRole();
  const subscription = await getUserSubscription(serviceSupabase, user.id);
  const tier = subscription?.tier === 'pro' && subscription?.status === 'active' ? 'pro' : 'free';
  const limits = TIER_LIMITS[tier];

  if (!limits.hasExport) {
    return NextResponse.json(
      { success: false, error: 'EXPORT_REQUIRES_PRO' },
      { status: 403 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const exportType = (searchParams.get('type') || 'watchlist') as ExportType;
  const format = (searchParams.get('format') || 'csv') as ExportFormat;

  if (!['watchlist', 'tokens'].includes(exportType)) {
    return NextResponse.json(
      { success: false, error: 'Invalid export type' },
      { status: 400 }
    );
  }

  if (!['csv', 'json'].includes(format)) {
    return NextResponse.json(
      { success: false, error: 'Invalid format' },
      { status: 400 }
    );
  }

  try {
    let data: Record<string, unknown>[] = [];
    let filename = '';

    if (exportType === 'watchlist') {
      // Fetch watchlist with token data
      const { data: watchlist, error } = await supabase
        .from('user_watchlists')
        .select(`
          chain_id,
          token_address,
          created_at
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch token metrics for each watchlist item
      const tokens: WatchlistToken[] = [];
      for (const item of watchlist || []) {
        const { data: metrics } = await supabase
          .from('token_metrics')
          .select('price, price_change_24h, volume_24h, liquidity, market_cap')
          .eq('chain_id', item.chain_id)
          .eq('token_address', item.token_address)
          .single();

        const { data: tokenInfo } = await supabase
          .from('tokens')
          .select('symbol, name')
          .eq('chain_id', item.chain_id)
          .eq('address', item.token_address)
          .single();

        const { data: riskInfo } = await supabase
          .from('risk_scores')
          .select('total_score')
          .eq('chain_id', item.chain_id)
          .eq('token_address', item.token_address)
          .single();

        tokens.push({
          chain_id: item.chain_id,
          token_address: item.token_address,
          symbol: tokenInfo?.symbol,
          name: tokenInfo?.name,
          price: metrics?.price,
          price_change_24h: metrics?.price_change_24h,
          volume_24h: metrics?.volume_24h,
          liquidity: metrics?.liquidity,
          market_cap: metrics?.market_cap,
          risk_score: riskInfo?.total_score,
        });
      }

      data = tokens as unknown as Record<string, unknown>[];
      filename = `nullcheck-watchlist-${new Date().toISOString().split('T')[0]}`;
    } else {
      // Export trending tokens
      const { data: trendingData, error } = await supabase
        .from('trending_tokens_mv')
        .select('*')
        .order('volume_24h', { ascending: false })
        .limit(100);

      if (error) throw error;

      data = (trendingData || []).map((t) => ({
        chain_id: t.chain_id,
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        price: t.price,
        price_change_1h: t.price_change_1h,
        price_change_24h: t.price_change_24h,
        volume_24h: t.volume_24h,
        liquidity: t.liquidity,
        market_cap: t.market_cap,
        risk_score: t.risk_score,
        risk_level: t.risk_level,
      }));
      filename = `nullcheck-tokens-${new Date().toISOString().split('T')[0]}`;
    }

    if (format === 'json') {
      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}.json"`,
        },
      });
    } else {
      const headers = data.length > 0 ? Object.keys(data[0]) : [];
      const csv = formatCSV(data, headers);

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      });
    }
  } catch (err) {
    console.error('Export error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to export data' },
      { status: 500 }
    );
  }
}
