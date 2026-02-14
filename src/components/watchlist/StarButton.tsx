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

  const watched = isWatched(chainId, address);
  const currentCount = watchedTokens.length;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

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
    const result = await toggleWatch(chainId, address);

    // Handle limit error from API
    if (!result.success && result.error === 'LIMIT_REACHED') {
      setShowUpgradePrompt(true);
    }

    setIsUpdating(false);
  };

  return (
    <>
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
