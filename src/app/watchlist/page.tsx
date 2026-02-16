'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { TokenTable } from '@/components/tokens/TokenTable';
import { TokenWithMetrics } from '@/types/token';
import { AuthModal } from '@/components/auth/AuthModal';

export default function WatchlistPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [tokens, setTokens] = useState<TokenWithMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    fetchWatchlist();
  }, [isAuthenticated, authLoading]);

  const fetchWatchlist = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/watchlist/tokens');

      if (!response.ok) {
        throw new Error(`Failed to fetch watchlist: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.tokens) {
        setTokens(data.tokens);
      }
    } catch (error) {
      console.error('Error fetching watchlist:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenClick = (token: TokenWithMetrics) => {
    router.push(`/token/${token.chainId}/${token.address}`);
  };

  if (authLoading) {
    return (
      <div className="w-full max-w-4xl relative">
        <div className="border-2 border-[var(--border)] bg-[var(--bg-primary)] p-6">
          <div className="text-neutral-500">loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl relative">
      {/* Title Row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="text-neutral-500 hover:text-[#ffffff] text-sm transition-colors"
          >
            ← back
          </button>
          <h1 className="text-3xl sm:text-4xl text-neutral-100">
            watchlist
          </h1>
        </div>
      </div>

      {/* Main Terminal Window */}
      <div className="border-2 border-[var(--border)] bg-[var(--bg-primary)]">
        {!isAuthenticated ? (
          <div className="p-12 text-center">
            <p className="text-neutral-500 mb-4">sign in to view your watchlist</p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="border border-[var(--border)] px-4 py-2 text-sm text-[#ffffff] hover:bg-neutral-900 transition-colors"
            >
              sign in
            </button>
            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
          </div>
        ) : tokens.length === 0 && !isLoading ? (
          <div className="p-12 text-center">
            <p className="text-neutral-500 mb-2">no tokens watched</p>
            <p className="text-neutral-600 text-sm">
              click the star on any token to add it here
            </p>
          </div>
        ) : (
          <div className="h-[80vh] overflow-auto">
            <TokenTable
              tokens={tokens}
              isLoading={isLoading}
              onTokenClick={handleTokenClick}
            />
          </div>
        )}
      </div>
    </div>
  );
}
