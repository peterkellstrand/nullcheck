/**
 * Price alerts job - checks active alerts against current prices
 * and triggers email notifications when conditions are met.
 */

import { createClient } from '@supabase/supabase-js';
import { sendPriceAlertEmail } from '@/lib/email/alerts';
import { PriceAlertRow } from '@/types/alert';
import { ChainId } from '@/types/chain';

// Service role client for alert operations
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface TokenPrice {
  chainId: ChainId;
  address: string;
  price: number;
}

/**
 * Fetch current prices for a batch of tokens from token_metrics
 */
async function fetchTokenPrices(
  supabase: ReturnType<typeof getServiceClient>,
  tokens: { chainId: string; address: string }[]
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();

  if (tokens.length === 0) return priceMap;

  // Group by chain for efficient querying
  const byChain = new Map<string, string[]>();
  for (const t of tokens) {
    const addrs = byChain.get(t.chainId) || [];
    addrs.push(t.address);
    byChain.set(t.chainId, addrs);
  }

  // Fetch prices for each chain
  for (const [chainId, addresses] of byChain) {
    const { data, error } = await supabase
      .from('token_metrics')
      .select('token_address, chain_id, price')
      .eq('chain_id', chainId)
      .in('token_address', addresses);

    if (error) {
      console.error(`Failed to fetch prices for ${chainId}:`, error);
      continue;
    }

    for (const row of data || []) {
      const key = `${row.chain_id}-${row.token_address}`;
      priceMap.set(key, Number(row.price));
    }
  }

  return priceMap;
}

/**
 * Get user email by user ID
 */
async function getUserEmail(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error || !data?.user?.email) {
    console.error(`Failed to get email for user ${userId}:`, error);
    return null;
  }

  return data.user.email;
}

/**
 * Check all active price alerts and trigger notifications
 */
export async function checkPriceAlerts(): Promise<Record<string, unknown>> {
  const supabase = getServiceClient();
  const startTime = Date.now();

  // 1. Fetch all active (non-triggered) alerts
  const { data: alerts, error: fetchError } = await supabase
    .from('price_alerts')
    .select('*')
    .eq('is_triggered', false)
    .order('created_at', { ascending: true });

  if (fetchError) {
    throw new Error(`Failed to fetch alerts: ${fetchError.message}`);
  }

  if (!alerts || alerts.length === 0) {
    return {
      alertsChecked: 0,
      alertsTriggered: 0,
      notificationsSent: 0,
      durationMs: Date.now() - startTime,
    };
  }

  const typedAlerts = alerts as PriceAlertRow[];

  // 2. Get unique tokens to fetch prices for
  const uniqueTokens = new Map<string, { chainId: string; address: string }>();
  for (const alert of typedAlerts) {
    const key = `${alert.chain_id}-${alert.token_address}`;
    if (!uniqueTokens.has(key)) {
      uniqueTokens.set(key, { chainId: alert.chain_id, address: alert.token_address });
    }
  }

  // 3. Fetch current prices
  const prices = await fetchTokenPrices(supabase, Array.from(uniqueTokens.values()));

  // 4. Check each alert
  const triggeredAlerts: { alert: PriceAlertRow; currentPrice: number }[] = [];

  for (const alert of typedAlerts) {
    const key = `${alert.chain_id}-${alert.token_address}`;
    const currentPrice = prices.get(key);

    if (currentPrice === undefined) {
      // No price data available, skip
      continue;
    }

    const targetPrice = Number(alert.target_price);
    let shouldTrigger = false;

    if (alert.alert_type === 'price_above' && currentPrice >= targetPrice) {
      shouldTrigger = true;
    } else if (alert.alert_type === 'price_below' && currentPrice <= targetPrice) {
      shouldTrigger = true;
    }

    if (shouldTrigger) {
      triggeredAlerts.push({ alert, currentPrice });
    }
  }

  // 5. Mark triggered alerts and send notifications
  let notificationsSent = 0;

  for (const { alert, currentPrice } of triggeredAlerts) {
    // Mark as triggered
    const { error: updateError } = await supabase
      .from('price_alerts')
      .update({
        is_triggered: true,
        triggered_at: new Date().toISOString(),
        triggered_price: currentPrice,
      })
      .eq('id', alert.id);

    if (updateError) {
      console.error(`Failed to update alert ${alert.id}:`, updateError);
      continue;
    }

    // Get user email and send notification
    const email = await getUserEmail(supabase, alert.user_id);

    if (email) {
      const sent = await sendPriceAlertEmail(email, {
        tokenSymbol: alert.token_symbol,
        tokenName: alert.token_name,
        chainId: alert.chain_id as ChainId,
        alertType: alert.alert_type as 'price_above' | 'price_below',
        targetPrice: Number(alert.target_price),
        triggeredPrice: currentPrice,
        tokenAddress: alert.token_address,
      });

      if (sent) {
        // Mark notification as sent
        await supabase
          .from('price_alerts')
          .update({ notification_sent: true })
          .eq('id', alert.id);

        notificationsSent++;
      }
    }
  }

  return {
    alertsChecked: typedAlerts.length,
    alertsTriggered: triggeredAlerts.length,
    notificationsSent,
    uniqueTokens: uniqueTokens.size,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Cleanup old triggered alerts (30 days)
 */
export async function cleanupOldAlerts(): Promise<Record<string, unknown>> {
  const supabase = getServiceClient();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoffTimestamp = cutoffDate.toISOString();

  const { count: beforeCount } = await supabase
    .from('price_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('is_triggered', true)
    .lt('triggered_at', cutoffTimestamp);

  const { error } = await supabase
    .from('price_alerts')
    .delete()
    .eq('is_triggered', true)
    .lt('triggered_at', cutoffTimestamp);

  if (error) {
    throw new Error(`Failed to cleanup old alerts: ${error.message}`);
  }

  return {
    deletedCount: beforeCount || 0,
    cutoffDate: cutoffTimestamp,
  };
}
