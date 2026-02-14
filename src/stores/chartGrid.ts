import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChainId } from '@/types/chain';
import { TIER_LIMITS } from '@/types/subscription';

export interface ChartToken {
  chainId: ChainId;
  address: string;
  symbol: string;
  name: string;
}

export type GridLayout = '2x2' | '3x3' | 'auto';
export type ChartTimeframe = '1h' | '4h' | '1d' | '1w';

interface ChartGridState {
  tokens: ChartToken[];
  layout: GridLayout;
  timeframe: ChartTimeframe;

  // Actions
  addToken: (token: ChartToken, maxTokens?: number) => void;
  removeToken: (chainId: ChainId, address: string) => void;
  clearTokens: () => void;
  setLayout: (layout: GridLayout) => void;
  setTimeframe: (timeframe: ChartTimeframe) => void;
  reorderTokens: (fromIndex: number, toIndex: number) => void;
}

// Export limits for use in components
export const CHART_LIMITS = {
  free: TIER_LIMITS.free.chartSlots,
  pro: TIER_LIMITS.pro.chartSlots,
};

const getKey = (chainId: ChainId, address: string) =>
  `${chainId}-${address.toLowerCase()}`;

export { getKey as getChartTokenKey };

export const useChartGridStore = create<ChartGridState>()(
  persist(
    (set, get) => ({
      tokens: [],
      layout: 'auto',
      timeframe: '1d',

      addToken: (token, maxTokens = CHART_LIMITS.pro) => {
        const state = get();
        // Prevent duplicates
        const exists = state.tokens.some(
          (t) => getKey(t.chainId, t.address) === getKey(token.chainId, token.address)
        );
        if (exists) return;

        // Limit to max tokens based on subscription tier
        if (state.tokens.length >= maxTokens) return;

        set({ tokens: [...state.tokens, token] });
      },

      removeToken: (chainId, address) => {
        const key = getKey(chainId, address);
        set((state) => ({
          tokens: state.tokens.filter(
            (t) => getKey(t.chainId, t.address) !== key
          ),
        }));
      },

      clearTokens: () => set({ tokens: [] }),

      setLayout: (layout) => set({ layout }),

      setTimeframe: (timeframe) => set({ timeframe }),

      reorderTokens: (fromIndex, toIndex) => {
        set((state) => {
          const newTokens = [...state.tokens];
          const [removed] = newTokens.splice(fromIndex, 1);
          newTokens.splice(toIndex, 0, removed);
          return { tokens: newTokens };
        });
      },
    }),
    {
      name: 'nullcheck-chart-grid',
    }
  )
);
