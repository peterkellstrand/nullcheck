import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getSupabaseServer, getSupabaseServerWithServiceRole } from '@/lib/db/supabase-server';
import { validateCsrfToken, createCsrfErrorResponse } from '@/lib/auth/csrf';
import { AgentTier, AGENT_LIMITS } from '@/types/subscription';

// Hash API key using SHA-256 (Web Crypto API for edge runtime)
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// GET - List user's API keys
export async function GET() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = await getSupabaseServerWithServiceRole();
  const { data, error } = await service
    .from('api_keys')
    .select('id, name, tier, daily_limit, monthly_limit, created_at, last_used, is_revoked, key_prefix, stripe_subscription_id')
    .eq('user_id', user.id)
    .eq('is_revoked', false)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }

  // Map keys to include display-friendly key preview
  const keys = data?.map(key => ({
    ...key,
    keyPreview: key.key_prefix || 'nk_****...', // Show prefix or placeholder
    monthly_limit: key.monthly_limit || key.daily_limit * 30, // Fallback for old keys
  }));

  return NextResponse.json({ success: true, keys });
}

// POST - Create new API key
export async function POST(req: NextRequest) {
  // Validate CSRF token for session-based requests
  if (!(await validateCsrfToken(req))) {
    return createCsrfErrorResponse();
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = await getSupabaseServerWithServiceRole();

  // Check if user has an agent subscription (existing key with stripe_subscription_id)
  const { data: existingKeys } = await service
    .from('api_keys')
    .select('tier, stripe_subscription_id')
    .eq('user_id', user.id)
    .eq('is_revoked', false)
    .not('stripe_subscription_id', 'is', null)
    .limit(1);

  const hasAgentSubscription = existingKeys && existingKeys.length > 0;
  const subscriptionTier = hasAgentSubscription ? existingKeys[0].tier as AgentTier : null;

  if (!hasAgentSubscription) {
    return NextResponse.json(
      { error: 'API subscription required to create keys. Subscribe at /pricing' },
      { status: 403 }
    );
  }

  // Parse request body
  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Use defaults
  }

  const name = body.name || 'API Key';
  // Use the tier from user's subscription
  const tier: AgentTier = subscriptionTier || 'developer';

  // Get limits from tier configuration
  const limits = AGENT_LIMITS[tier] || AGENT_LIMITS.developer;
  // Convert monthly limit to daily (approximate)
  const dailyLimit = Math.ceil(limits.apiCallsPerMonth / 30);

  // Generate API key with prefix
  const apiKey = `nk_${nanoid(32)}`;
  const hashedKey = await hashApiKey(apiKey);
  const keyPrefix = apiKey.substring(0, 12) + '...';

  // SECURITY: Only store hashed key, never plain text
  const { data, error } = await service
    .from('api_keys')
    .insert({
      user_id: user.id,
      // api_key intentionally NOT stored - security risk
      hashed_key: hashedKey, // Only store hashed version for secure lookups
      key_prefix: keyPrefix, // Store prefix for display in UI
      name,
      tier,
      daily_limit: dailyLimit,
    })
    .select('id, name, tier, daily_limit, created_at')
    .single();

  if (error) {
    console.error('Failed to create API key:', error);
    // Check if it's a key limit error
    if (error.message?.includes('API key limit')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }

  // Return the full API key only once (won't be shown again)
  // IMPORTANT: This is the only time the user sees their full key
  return NextResponse.json({
    success: true,
    key: {
      ...data,
      apiKey, // Only returned on creation - user must save this!
      keyPreview: keyPrefix,
    },
    warning: 'Save this API key securely. You will not be able to see it again.',
  });
}

// DELETE - Revoke API key
export async function DELETE(req: NextRequest) {
  // Validate CSRF token for session-based requests
  if (!(await validateCsrfToken(req))) {
    return createCsrfErrorResponse();
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const keyId = searchParams.get('id');

  if (!keyId) {
    return NextResponse.json({ error: 'Key ID required' }, { status: 400 });
  }

  const service = await getSupabaseServerWithServiceRole();

  // Verify the key belongs to the user
  const { data: key } = await service
    .from('api_keys')
    .select('id, user_id')
    .eq('id', keyId)
    .single();

  if (!key || key.user_id !== user.id) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }

  // Soft delete (revoke)
  const { error } = await service
    .from('api_keys')
    .update({ is_revoked: true })
    .eq('id', keyId);

  if (error) {
    return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
