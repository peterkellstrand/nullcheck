import { create } from 'zustand';
import { TokenWithMetrics } from '@/types/token';
import { ChainId } from '@/types/chain';

interface PriceUpdate {
  price: number;
  priceChange1h: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
}

interface TokensState {
  tokens: TokenWithMetrics[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;

  // Actions
  setTokens: (tokens: TokenWithMetrics[]) => void;
  updateToken: (address: string, chainId: ChainId, updates: Partial<TokenWithMetrics>) => void;
  updatePrices: (updates: Record<string, PriceUpdate>) => void;
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

  updatePrices: (updates) =>
    set((state) => ({
      tokens: state.tokens.map((t) => {
        const key = `${t.chainId}-${t.address.toLowerCase()}`;
        const update = updates[key];
        if (update) {
          return {
            ...t,
            metrics: {
              ...t.metrics,
              price: update.price,
              priceChange1h: update.priceChange1h,
              priceChange24h: update.priceChange24h,
              volume24h: update.volume24h,
              liquidity: update.liquidity,
              updatedAt: new Date().toISOString(),
            },
          };
        }
        return t;
      }),
      lastUpdated: new Date(),
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
