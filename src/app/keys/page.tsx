'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui';
import { AGENT_PRICING, AGENT_LIMITS, AgentTier } from '@/types/subscription';

interface ApiKey {
  id: string;
  name: string;
  tier: AgentTier;
  keyPreview: string;
  daily_limit: number;
  monthly_limit: number;
  created_at: string;
  last_used: string | null;
  stripe_subscription_id: string | null;
}

interface UsageData {
  date: string;
  request_count: number;
}

export default function ApiKeysPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<Record<string, UsageData[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await fetch('/api/keys');
      const data = await response.json();

      if (data.success) {
        setKeys(data.keys || []);
      } else {
        setError(data.error || 'Failed to load API keys');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const fetchUsage = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await fetch('/api/usage');
      const data = await response.json();

      if (data.success) {
        setUsage(data.usage || {});
      }
    } catch (err) {
      console.error('Failed to fetch usage:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchKeys();
      fetchUsage();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [isAuthenticated, authLoading, fetchKeys, fetchUsage]);

  const handleCreateKey = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName || 'API Key' }),
      });

      const data = await response.json();

      if (data.success && data.key) {
        setCreatedKey(data.key.apiKey);
        setNewKeyName('');
        await fetchKeys();
      } else {
        setError(data.error || 'Failed to create key');
      }
    } catch (err) {
      setError('Failed to create key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this key? This cannot be undone.')) {
      return;
    }

    setRevokingId(keyId);

    try {
      const response = await fetch(`/api/keys?id=${keyId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        await fetchKeys();
      } else {
        setError(data.error || 'Failed to revoke key');
      }
    } catch (err) {
      setError('Failed to revoke key');
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getTodayUsage = (keyId: string): number => {
    const keyUsage = usage[keyId];
    if (!keyUsage || keyUsage.length === 0) return 0;

    const today = new Date().toISOString().split('T')[0];
    const todayData = keyUsage.find(u => u.date === today);
    return todayData?.request_count || 0;
  };

  const getMonthUsage = (keyId: string): number => {
    const keyUsage = usage[keyId];
    if (!keyUsage || keyUsage.length === 0) return 0;

    return keyUsage.reduce((sum, u) => sum + u.request_count, 0);
  };

  const hasAgentSubscription = keys.some(k => k.stripe_subscription_id !== null);

  if (authLoading || isLoading) {
    return (
      <div className="w-full max-w-[1030px]">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm transition-colors">
            &larr; back
          </Link>
        </div>
        <div className="border-2 border-[var(--border)] bg-[var(--bg-primary)] p-8">
          <p className="text-[var(--text-muted)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-[1030px]">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm transition-colors">
            &larr; back
          </Link>
        </div>
        <div className="border-2 border-[var(--border)] bg-[var(--bg-primary)] p-8 text-center">
          <h1 className="text-xl text-[var(--text-primary)] mb-4">API Keys</h1>
          <p className="text-[var(--text-secondary)] mb-6">Sign in to manage your API keys.</p>
          <Link href="/">
            <Button>Sign in</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1030px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm transition-colors">
          &larr; back
        </Link>
      </div>

      {/* Main Container */}
      <div className="border-2 border-[var(--border)] bg-[var(--bg-primary)]">
        {/* Title */}
        <div className="p-6 border-b border-[var(--border)]">
          <h1 className="text-xl text-[var(--text-primary)] mb-2">API Keys</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Manage your API keys for programmatic access.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 m-6 border border-red-500 bg-red-500/10 text-red-400 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-4 underline">Dismiss</button>
          </div>
        )}

        {/* New Key Created */}
        {createdKey && (
          <div className="p-4 m-6 border border-emerald-500 bg-emerald-500/10">
            <p className="text-emerald-400 text-sm font-medium mb-2">
              API Key Created - Save this now!
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-mono break-all">
                {createdKey}
              </code>
              <Button onClick={() => copyToClipboard(createdKey)} variant="secondary" className="text-sm">
                Copy
              </Button>
            </div>
            <p className="text-[var(--text-muted)] text-xs mt-2">
              This key will not be shown again. Store it securely.
            </p>
            <button
              onClick={() => setCreatedKey(null)}
              className="text-emerald-400 text-sm underline mt-2"
            >
              I&apos;ve saved my key
            </button>
          </div>
        )}

        {/* API Keys List */}
        <div className="p-6">
          {keys.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[var(--text-secondary)] mb-4">No API keys yet.</p>
              {!hasAgentSubscription && (
                <p className="text-[var(--text-muted)] text-sm mb-6">
                  Subscribe to an API tier to get started.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="border border-[var(--border)] bg-[var(--bg-secondary)] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[var(--text-primary)] font-medium">{key.name}</span>
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                          {key.tier}
                        </span>
                      </div>
                      <code className="text-[var(--text-muted)] text-sm font-mono">
                        {key.keyPreview}
                      </code>
                    </div>
                    <Button
                      onClick={() => handleRevokeKey(key.id)}
                      disabled={revokingId === key.id}
                      variant="secondary"
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      {revokingId === key.id ? 'Revoking...' : 'Revoke'}
                    </Button>
                  </div>

                  {/* Usage Stats */}
                  <div className="mt-4 pt-4 border-t border-[var(--border)] grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-[var(--text-muted)]">Today</span>
                      <p className="text-[var(--text-primary)]">
                        {getTodayUsage(key.id).toLocaleString()} calls
                      </p>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">This month</span>
                      <p className="text-[var(--text-primary)]">
                        {getMonthUsage(key.id).toLocaleString()} / {(key.monthly_limit || key.daily_limit * 30).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">Created</span>
                      <p className="text-[var(--text-primary)]">
                        {new Date(key.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">Last used</span>
                      <p className="text-[var(--text-primary)]">
                        {key.last_used ? new Date(key.last_used).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create New Key */}
          {hasAgentSubscription && (
            <div className="mt-6 pt-6 border-t border-[var(--border)]">
              <h3 className="text-[var(--text-primary)] font-medium mb-3">Create New Key</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Key name (optional)"
                  className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm"
                />
                <Button
                  onClick={handleCreateKey}
                  disabled={isCreating}
                >
                  {isCreating ? 'Creating...' : 'Create Key'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* No Subscription CTA */}
        {!hasAgentSubscription && keys.length === 0 && (
          <div className="p-6 border-t border-[var(--border)] bg-[var(--bg-secondary)]">
            <h2 className="text-[var(--text-primary)] font-medium mb-4">Get API Access</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 border border-[var(--border)] bg-[var(--bg-primary)]">
                <div className="text-[var(--text-primary)] font-medium">Developer</div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">${AGENT_PRICING.developer.amount}</div>
                <div className="text-sm text-[var(--text-muted)]">{AGENT_PRICING.developer.calls} calls/mo</div>
              </div>
              <div className="p-4 border border-blue-500 bg-blue-500/10">
                <div className="text-[var(--text-primary)] font-medium">Professional</div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">${AGENT_PRICING.professional.amount}</div>
                <div className="text-sm text-[var(--text-muted)]">{AGENT_PRICING.professional.calls} calls/mo</div>
              </div>
              <div className="p-4 border border-[var(--border)] bg-[var(--bg-primary)]">
                <div className="text-[var(--text-primary)] font-medium">Business</div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">${AGENT_PRICING.business.amount}</div>
                <div className="text-sm text-[var(--text-muted)]">{AGENT_PRICING.business.calls} calls/mo</div>
              </div>
            </div>
            <Link href="/pricing">
              <Button className="w-full">View Pricing</Button>
            </Link>
          </div>
        )}

        {/* Documentation Link */}
        <div className="p-6 border-t border-[var(--border)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[var(--text-primary)] font-medium">API Documentation</h3>
              <p className="text-sm text-[var(--text-muted)]">
                Learn how to integrate with the nullcheck API.
              </p>
            </div>
            <Link href="/docs">
              <Button variant="secondary">View Docs</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
