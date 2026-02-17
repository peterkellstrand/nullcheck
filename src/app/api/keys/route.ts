import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getSupabaseServer, getSupabaseServerWithServiceRole } from '@/lib/db/supabase-server';

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
    .select('id, name, tier, daily_limit, created_at, last_used, is_revoked, key_prefix')
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
  }));

  return NextResponse.json({ success: true, keys });
}

// POST - Create new API key
export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user has PRO subscription
  const service = await getSupabaseServerWithServiceRole();
  const { data: subscription } = await service
    .from('user_subscriptions')
    .select('tier, status')
    .eq('user_id', user.id)
    .single();

  if (!subscription || subscription.tier !== 'pro' || subscription.status !== 'active') {
    return NextResponse.json(
      { error: 'PRO subscription required to create API keys' },
      { status: 403 }
    );
  }

  // Parse request body
  let body: { name?: string; tier?: 'starter' | 'builder' | 'scale' } = {};
  try {
    body = await req.json();
  } catch {
    // Use defaults
  }

  const name = body.name || 'API Key';
  const tier = body.tier || 'starter';

  // Set daily limit based on tier
  const dailyLimits: Record<string, number> = {
    starter: 10000,
    builder: 100000,
    scale: 1000000,
  };
  const dailyLimit = dailyLimits[tier] || 10000;

  // Generate API key with prefix
  const apiKey = `nk_${nanoid(32)}`;
  const hashedKey = await hashApiKey(apiKey);
  const keyPrefix = apiKey.substring(0, 12) + '...';

  const { data, error } = await service
    .from('api_keys')
    .insert({
      user_id: user.id,
      api_key: apiKey, // Store plain text for backward compatibility (will be removed after migration)
      hashed_key: hashedKey, // Store hashed version for secure lookups
      key_prefix: keyPrefix, // Store prefix for display
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
