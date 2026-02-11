import { create } from 'zustand';
import { ChainId } from '@/types/chain';
import { SortField, SortDirection, TokenFilters } from '@/types/token';

interface FiltersState extends TokenFilters {
  searchQuery: string;
  sortField: SortField;
  sortDirection: SortDirection;

  // Actions
  setSearchQuery: (query: string) => void;
  setChain: (chain?: ChainId) => void;
  setMinLiquidity: (value?: number) => void;
  setMaxRiskScore: (value?: number) => void;
  setSort: (field: SortField, direction?: SortDirection) => void;
  toggleSort: (field: SortField) => void;
  resetFilters: () => void;
}

const initialState = {
  searchQuery: '',
  chain: undefined,
  minLiquidity: undefined,
  maxLiquidity: undefined,
  minVolume: undefined,
  maxRiskScore: undefined,
  verified: undefined,
  sortField: 'volume24h' as SortField,
  sortDirection: 'desc' as SortDirection,
};

export const useFiltersStore = create<FiltersState>((set) => ({
  ...initialState,

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setChain: (chain) => set({ chain }),

  setMinLiquidity: (minLiquidity) => set({ minLiquidity }),

  setMaxRiskScore: (maxRiskScore) => set({ maxRiskScore }),

  setSort: (sortField, sortDirection = 'desc') =>
    set({ sortField, sortDirection }),

  toggleSort: (field) =>
    set((state) => ({
      sortField: field,
      sortDirection:
        state.sortField === field && state.sortDirection === 'desc'
          ? 'asc'
          : 'desc',
    })),

  resetFilters: () => set(initialState),
}));
