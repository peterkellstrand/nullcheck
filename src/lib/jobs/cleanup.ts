/**
 * Cleanup job handlers for removing old/expired data
 */

import { createClient } from '@supabase/supabase-js';

// Service role client for cleanup operations
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

/**
 * Delete webhook deliveries older than 7 days
 */
export async function cleanupWebhookDeliveries(): Promise<Record<string, unknown>> {
  const supabase = getServiceClient();

  // Calculate cutoff date (7 days ago)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);
  const cutoffTimestamp = cutoffDate.toISOString();

  // Count before delete
  const { count: beforeCount } = await supabase
    .from('webhook_deliveries')
    .select('id', { count: 'exact', head: true })
    .lt('delivered_at', cutoffTimestamp);

  // Delete old deliveries
  const { error } = await supabase
    .from('webhook_deliveries')
    .delete()
    .lt('delivered_at', cutoffTimestamp);

  if (error) {
    throw new Error(`Failed to cleanup webhook deliveries: ${error.message}`);
  }

  return {
    deletedCount: beforeCount || 0,
    cutoffDate: cutoffTimestamp,
  };
}

/**
 * Delete idempotent request records older than 24 hours
 */
export async function cleanupIdempotentRequests(): Promise<Record<string, unknown>> {
  const supabase = getServiceClient();

  // Calculate cutoff date (24 hours ago)
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - 24);
  const cutoffTimestamp = cutoffDate.toISOString();

  // Count before delete
  const { count: beforeCount } = await supabase
    .from('idempotent_requests')
    .select('id', { count: 'exact', head: true })
    .lt('created_at', cutoffTimestamp);

  // Delete old records
  const { error } = await supabase
    .from('idempotent_requests')
    .delete()
    .lt('created_at', cutoffTimestamp);

  if (error) {
    // Table might not exist yet, which is fine
    if (!error.message.includes('does not exist')) {
      throw new Error(`Failed to cleanup idempotent requests: ${error.message}`);
    }
    return { deletedCount: 0, note: 'Table does not exist' };
  }

  return {
    deletedCount: beforeCount || 0,
    cutoffDate: cutoffTimestamp,
  };
}

/**
 * Delete expired risk score cache entries
 */
export async function cleanupExpiredRiskScores(): Promise<Record<string, unknown>> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  // Count before delete
  const { count: beforeCount } = await supabase
    .from('risk_scores')
    .select('id', { count: 'exact', head: true })
    .lt('expires_at', now);

  // Delete expired records
  const { error } = await supabase
    .from('risk_scores')
    .delete()
    .lt('expires_at', now);

  if (error) {
    // Table might not have expires_at column
    if (!error.message.includes('does not exist') && !error.message.includes('column')) {
      throw new Error(`Failed to cleanup risk scores: ${error.message}`);
    }
    return { deletedCount: 0, note: 'Column or table does not exist' };
  }

  return {
    deletedCount: beforeCount || 0,
    cutoffDate: now,
  };
}

/**
 * Delete old API usage records (keep last 90 days)
 */
export async function cleanupOldUsageRecords(): Promise<Record<string, unknown>> {
  const supabase = getServiceClient();

  // Calculate cutoff date (90 days ago)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

  // Count before delete
  const { count: beforeCount } = await supabase
    .from('api_usage')
    .select('id', { count: 'exact', head: true })
    .lt('date', cutoffDateStr);

  // Delete old records
  const { error } = await supabase
    .from('api_usage')
    .delete()
    .lt('date', cutoffDateStr);

  if (error) {
    throw new Error(`Failed to cleanup usage records: ${error.message}`);
  }

  return {
    deletedCount: beforeCount || 0,
    cutoffDate: cutoffDateStr,
  };
}

/**
 * Delete old webhook events (processed events older than 30 days)
 */
export async function cleanupWebhookEvents(): Promise<Record<string, unknown>> {
  const supabase = getServiceClient();

  // Calculate cutoff date (30 days ago)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoffTimestamp = cutoffDate.toISOString();

  // Count before delete (only processed events)
  const { count: beforeCount } = await supabase
    .from('webhook_events')
    .select('id', { count: 'exact', head: true })
    .eq('processed', true)
    .lt('created_at', cutoffTimestamp);

  // Delete old processed events
  const { error } = await supabase
    .from('webhook_events')
    .delete()
    .eq('processed', true)
    .lt('created_at', cutoffTimestamp);

  if (error) {
    if (!error.message.includes('does not exist')) {
      throw new Error(`Failed to cleanup webhook events: ${error.message}`);
    }
    return { deletedCount: 0, note: 'Table does not exist' };
  }

  return {
    deletedCount: beforeCount || 0,
    cutoffDate: cutoffTimestamp,
  };
}
