'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWatchlist } from '@/hooks/useWatchlist';
import { ChainId } from '@/types/chain';
import { AuthModal } from '@/components/auth/AuthModal';

interface StarButtonProps {
  chainId: ChainId;
  address: string;
}

export function StarButton({ chainId, address }: StarButtonProps) {
  const { isAuthenticated } = useAuth();
  const { isWatched, toggleWatch } = useWatchlist();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const watched = isWatched(chainId, address);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    if (isUpdating) return;

    setIsUpdating(true);
    await toggleWatch(chainId, address);
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
    </>
  );
}
