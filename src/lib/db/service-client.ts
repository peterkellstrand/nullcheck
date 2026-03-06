/**
 * Shared Supabase service role client for server-side operations
 * that don't need request-scoped cookies (jobs, webhooks, admin routes, etc.)
 *
 * Uses a singleton so only one client instance is created per process.
 *
 * Use getSupabaseServer() / getSupabaseServerWithServiceRole() from
 * supabase-server.ts for request-scoped operations that need cookie auth.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * Get (or create) a singleton Supabase client with the service role key.
 * This bypasses RLS and should only be used in trusted server contexts.
 */
export function getServiceClient(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured');
  }

  _client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _client;
}
