/**
 * Refresh job handlers for updating cached/materialized data
 */

import { getServiceClient } from '@/lib/db/service-client';

/**
 * Refresh trending tokens materialized view
 *
 * Note: This requires the materialized view to be created first.
 * If the view doesn't exist, this job will just log and return success.
 */
export async function refreshTrendingTokens(): Promise<Record<string, unknown>> {
  const supabase = getServiceClient();
  const startTime = Date.now();

  try {
    // Call the refresh function if it exists
    const { error } = await supabase.rpc('refresh_trending_tokens');

    if (error) {
      // Function might not exist yet
      if (error.message.includes('does not exist') || error.message.includes('function')) {
        console.log('[refresh-trending] Materialized view not configured yet');
        return {
          refreshed: false,
          note: 'Materialized view not configured',
        };
      }
      throw error;
    }

    const durationMs = Date.now() - startTime;

    return {
      refreshed: true,
      durationMs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[refresh-trending] Error:', message);

    return {
      refreshed: false,
      error: message,
    };
  }
}

