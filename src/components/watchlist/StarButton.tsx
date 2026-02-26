'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useSubscription } from '@/hooks/useSubscription';
import { ChainId } from '@/types/chain';
import { AuthModal } from '@/components/auth/AuthModal';
import { UpgradePrompt } from '@/components/subscription/UpgradePrompt';

interface StarButtonProps {
  chainId: ChainId;
  address: string;
}

export function StarButton({ chainId, address }: StarButtonProps) {
  const { isAuthenticated } = useAuth();
  const { isWatched, toggleWatch, watchedTokens } = useWatchlist();
  const { limits, canAddToWatchlist } = useSubscription();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watched = isWatched(chainId, address);
  const currentCount = watchedTokens.length;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null); // Clear previous error

    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    if (isUpdating) return;

    // Check limit before adding (not removing)
    if (!watched && !canAddToWatchlist(currentCount)) {
      setShowUpgradePrompt(true);
      return;
    }

    setIsUpdating(true);
    try {
      const result = await toggleWatch(chainId, address);

      // Handle limit error from API
      if (!result.success) {
        if (result.error === 'LIMIT_REACHED') {
          setShowUpgradePrompt(true);
        } else {
          setError('Failed to update watchlist');
          // Clear error after 3 seconds
          setTimeout(() => setError(null), 3000);
        }
      }
    } catch (err) {
      console.error('Watchlist toggle error:', err);
      setError('Failed to update watchlist');
      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000);
    }

    setIsUpdating(false);
  };

  return (
    <>
      <div className="relative inline-block">
        <button
          onClick={handleClick}
          disabled={isUpdating}
          className={`text-lg transition-colors ${
            watched
              ? 'text-[#ffffff]'
              : 'text-neutral-700 hover:text-neutral-400'
          } ${isUpdating ? 'opacity-50' : ''}`}
          title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          {watched ? '★' : '☆'}
        </button>
        {error && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 text-xs text-red-400 bg-neutral-900 border border-red-800 rounded whitespace-nowrap z-10">
            {error}
          </div>
        )}
      </div>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <UpgradePrompt
        isOpen={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        feature="watchlist"
        currentCount={currentCount}
        limit={limits.watchlistTokens}
      />
    </>
  );
}
