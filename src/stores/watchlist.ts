import { create } from 'zustand';
import { ChainId } from '@/types/chain';

interface WatchlistState {
  watchedTokens: Set<string>;
  isLoading: boolean;

  // Actions
  setWatchlist: (keys: string[]) => void;
  addToken: (chainId: ChainId, address: string) => void;
  removeToken: (chainId: ChainId, address: string) => void;
  isWatched: (chainId: ChainId, address: string) => boolean;
  reset: () => void;
}

const getKey = (chainId: ChainId, address: string) =>
  `${chainId}-${address.toLowerCase()}`;

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  watchedTokens: new Set(),
  isLoading: false,

  setWatchlist: (keys) => {
    set({ watchedTokens: new Set(keys), isLoading: false });
  },

  addToken: (chainId, address) => {
    const key = getKey(chainId, address);
    set((state) => ({
      watchedTokens: new Set([...state.watchedTokens, key]),
    }));
  },

  removeToken: (chainId, address) => {
    const key = getKey(chainId, address);
    set((state) => {
      const newSet = new Set(state.watchedTokens);
      newSet.delete(key);
      return { watchedTokens: newSet };
    });
  },

  isWatched: (chainId, address) => {
    const key = getKey(chainId, address);
    return get().watchedTokens.has(key);
  },

  reset: () => {
    set({ watchedTokens: new Set(), isLoading: false });
  },
}));
