import { create } from 'zustand';
import { TokenWithMetrics } from '@/types/token';
import { ChainId } from '@/types/chain';

interface TokensState {
  tokens: TokenWithMetrics[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;

  // Actions
  setTokens: (tokens: TokenWithMetrics[]) => void;
  updateToken: (address: string, chainId: ChainId, updates: Partial<TokenWithMetrics>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useTokensStore = create<TokensState>((set) => ({
  tokens: [],
  isLoading: false,
  error: null,
  lastUpdated: null,

  setTokens: (tokens) =>
    set({
      tokens,
      lastUpdated: new Date(),
      error: null,
    }),

  updateToken: (address, chainId, updates) =>
    set((state) => ({
      tokens: state.tokens.map((t) =>
        t.address.toLowerCase() === address.toLowerCase() && t.chainId === chainId
          ? { ...t, ...updates }
          : t
      ),
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  reset: () =>
    set({
      tokens: [],
      isLoading: false,
      error: null,
      lastUpdated: null,
    }),
}));
