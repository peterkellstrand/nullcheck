'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSubscription } from '@/hooks/useSubscription';

interface ApiKey {
  id: string;
  name: string;
  tier: 'starter' | 'builder' | 'scale';
  daily_limit: number;
  created_at: string;
  last_used: string | null;
}

interface NewKeyResponse {
  success: boolean;
  key?: {
    id: string;
    name: string;
    tier: string;
    daily_limit: number;
    created_at: string;
    apiKey: string;
  };
  error?: string;
}

export default function ApiKeysPage() {
  const router = useRouter();
  const { isPro, isLoading: subLoading } = useSubscription();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyTier, setNewKeyTier] = useState<'starter' | 'builder' | 'scale'>('starter');
  const [isCreating, setIsCreating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/keys');
      const data = await response.json();

      if (data.success) {
        setKeys(data.keys || []);
      } else {
        setError(data.error || 'Failed to fetch API keys');
      }
    } catch (err) {
      setError('Failed to fetch API keys');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!subLoading && isPro) {
      fetchKeys();
    }
  }, [subLoading, isPro, fetchKeys]);

  const createKey = async () => {
    if (!newKeyName.trim()) {
      setError('Please enter a name for the API key');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName, tier: newKeyTier }),
      });

      const data: NewKeyResponse = await response.json();

      if (data.success && data.key) {
        setNewlyCreatedKey(data.key.apiKey);
        setNewKeyName('');
        fetchKeys();
      } else {
        setError(data.error || 'Failed to create API key');
      }
    } catch (err) {
      setError('Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const revokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/keys?id=${keyId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        fetchKeys();
      } else {
        setError(data.error || 'Failed to revoke API key');
      }
    } catch (err) {
      setError('Failed to revoke API key');
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Not PRO - show upgrade prompt
  if (!subLoading && !isPro) {
    return (
      <div className="w-full max-w-[1030px]">
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/"
            className="text-neutral-500 hover:text-[var(--text-primary)] text-sm transition-colors"
          >
            ← back
          </Link>
        </div>

        <div className="border-2 border-[var(--border)] bg-[var(--bg-primary)] p-8">
          <h1 className="text-xl text-[var(--text-primary)] mb-4">API Keys</h1>
          <p className="text-neutral-400 mb-6">
            API keys allow AI agents and scripts to access null//check data programmatically.
          </p>
          <div className="bg-neutral-900 border border-neutral-800 p-6 text-center">
            <p className="text-neutral-300 mb-4">
              API key management requires a PRO subscription.
            </p>
            <Link
              href="/pricing"
              className="inline-block px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition-colors"
            >
              Upgrade to PRO
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1030px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/"
          className="text-neutral-500 hover:text-[var(--text-primary)] text-sm transition-colors"
        >
          ← back
        </Link>
      </div>

      {/* Main Container */}
      <div className="border-2 border-[var(--border)] bg-[var(--bg-primary)]">
        {/* Title */}
        <div className="p-6 border-b border-[var(--border)]">
          <h1 className="text-xl text-[var(--text-primary)] mb-2">API Keys</h1>
          <p className="text-sm text-neutral-400">
            Create API keys for AI agents and scripts to access null//check data.
          </p>
        </div>

        {/* Newly Created Key Alert */}
        {newlyCreatedKey && (
          <div className="p-6 border-b border-[var(--border)] bg-emerald-950/30">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-emerald-400 text-sm mb-2">
                  API key created successfully. Copy it now — it won't be shown again.
                </p>
                <code className="block bg-[var(--bg-primary)] px-4 py-3 text-sm text-[var(--text-primary)] font-mono break-all border border-neutral-800">
                  {newlyCreatedKey}
                </code>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(newlyCreatedKey)}
                  className="px-3 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-[var(--text-primary)] transition-colors"
                >
                  {copied ? 'copied!' : 'copy'}
                </button>
                <button
                  onClick={() => setNewlyCreatedKey(null)}
                  className="px-3 py-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="px-6 py-3 border-b border-[var(--border)] bg-red-950/30">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Create New Key */}
        <div className="p-6 border-b border-[var(--border)]">
          <h2 className="text-sm text-neutral-400 mb-4">Create New Key</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g., Trading Bot)"
              className="flex-1 bg-neutral-900 border border-neutral-700 px-4 py-2 text-sm text-[var(--text-primary)] placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
            />
            <select
              value={newKeyTier}
              onChange={(e) => setNewKeyTier(e.target.value as 'starter' | 'builder' | 'scale')}
              className="bg-neutral-900 border border-neutral-700 px-4 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-neutral-500"
            >
              <option value="starter">Starter (10K/day) - Free</option>
              <option value="builder">Builder (100K/day) - $19/mo</option>
              <option value="scale">Scale (1M/day) - $49/mo</option>
            </select>
            <button
              onClick={createKey}
              disabled={isCreating}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white text-sm transition-colors"
            >
              {isCreating ? 'creating...' : 'create key'}
            </button>
          </div>
        </div>

        {/* Existing Keys */}
        <div className="p-6">
          <h2 className="text-sm text-neutral-400 mb-4">Your API Keys</h2>

          {isLoading ? (
            <div className="text-neutral-500 text-sm">Loading...</div>
          ) : keys.length === 0 ? (
            <div className="text-neutral-600 text-sm py-8 text-center border border-neutral-800 bg-neutral-900/50">
              No API keys yet. Create one above.
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-neutral-800 bg-neutral-900/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[var(--text-primary)] text-sm font-medium truncate">
                        {key.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] ${
                          key.tier === 'scale'
                            ? 'bg-violet-900/50 text-violet-400 border border-violet-800'
                            : key.tier === 'builder'
                            ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800'
                            : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                        }`}
                      >
                        {key.tier.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-500 space-x-3">
                      <span>{key.daily_limit.toLocaleString()} calls/day</span>
                      <span>Created {formatDate(key.created_at)}</span>
                      {key.last_used && (
                        <span>Last used {formatDate(key.last_used)}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => revokeKey(key.id)}
                    className="px-3 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-red-900/50 transition-colors"
                  >
                    revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Usage Info */}
        <div className="p-6 border-t border-neutral-800 bg-neutral-900/30">
          <h2 className="text-sm text-neutral-400 mb-3">API Tiers</h2>
          <div className="grid grid-cols-3 gap-4 mb-4 text-xs">
            <div className="p-3 border border-neutral-700 bg-neutral-900">
              <div className="text-neutral-300 font-medium">Starter</div>
              <div className="text-neutral-500">10K calls/day</div>
              <div className="text-emerald-400 mt-1">Free with PRO</div>
            </div>
            <div className="p-3 border border-emerald-800 bg-emerald-900/20">
              <div className="text-emerald-400 font-medium">Builder</div>
              <div className="text-neutral-500">100K calls/day</div>
              <div className="text-emerald-400 mt-1">$19/mo</div>
            </div>
            <div className="p-3 border border-violet-800 bg-violet-900/20">
              <div className="text-violet-400 font-medium">Scale</div>
              <div className="text-neutral-500">1M calls/day</div>
              <div className="text-violet-400 mt-1">$49/mo</div>
            </div>
          </div>
          <div className="text-xs text-neutral-500 space-y-2">
            <p>
              <span className="text-neutral-300">Authentication:</span> Include your API key using the{' '}
              <code className="px-1 py-0.5 bg-neutral-800 text-emerald-400">x-api-key</code> header or{' '}
              <code className="px-1 py-0.5 bg-neutral-800 text-emerald-400">?api_key=</code> query parameter.
            </p>
            <p>
              <span className="text-neutral-300">Example:</span>{' '}
              <code className="px-1 py-0.5 bg-neutral-800 text-neutral-300">
                curl -H "x-api-key: nk_..." https://nullcheck.io/api/tokens
              </code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
