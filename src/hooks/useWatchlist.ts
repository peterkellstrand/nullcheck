'use client';

import { useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useWatchlistStore } from '@/stores/watchlist';
import { ChainId } from '@/types/chain';

export function useWatchlist() {
  const { user, isAuthenticated } = useAuth();
  const { watchedTokens, setWatchlist, addToken, removeToken, isWatched, reset } =
    useWatchlistStore();

  // Fetch watchlist on auth state change
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchWatchlist();
    } else {
      reset();
    }
  }, [isAuthenticated, user?.id]);

  const fetchWatchlist = useCallback(async () => {
    try {
      const response = await fetch('/api/watchlist');
      const data = await response.json();

      if (data.success && data.keys) {
        setWatchlist(data.keys);
      }
    } catch (error) {
      console.error('Error fetching watchlist:', error);
    }
  }, [setWatchlist]);

  const toggleWatch = useCallback(
    async (chainId: ChainId, address: string) => {
      if (!isAuthenticated) {
        return { success: false, needsAuth: true };
      }

      const currentlyWatched = isWatched(chainId, address);

      // Optimistic update
      if (currentlyWatched) {
        removeToken(chainId, address);
      } else {
        addToken(chainId, address);
      }

      try {
        if (currentlyWatched) {
          const response = await fetch(
            `/api/watchlist/${chainId}/${address.toLowerCase()}`,
            { method: 'DELETE' }
          );
          const data = await response.json();

          if (!data.success) {
            // Rollback
            addToken(chainId, address);
            return { success: false };
          }
        } else {
          const response = await fetch('/api/watchlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chainId, address: address.toLowerCase() }),
          });
          const data = await response.json();

          if (!data.success) {
            // Rollback
            removeToken(chainId, address);
            return { success: false, error: data.error };
          }
        }

        return { success: true };
      } catch (error) {
        // Rollback on error
        if (currentlyWatched) {
          addToken(chainId, address);
        } else {
          removeToken(chainId, address);
        }
        console.error('Error toggling watchlist:', error);
        return { success: false };
      }
    },
    [isAuthenticated, isWatched, addToken, removeToken]
  );

  return {
    watchedTokens: Array.from(watchedTokens),
    isWatched,
    toggleWatch,
    refetch: fetchWatchlist,
  };
}
