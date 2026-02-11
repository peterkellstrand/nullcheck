import { create } from 'zustand';
import { TokenWithMetrics } from '@/types/token';

interface UIState {
  // Selected token for detail view
  selectedToken: TokenWithMetrics | null;
  isDetailOpen: boolean;

  // Risk panel
  showRiskPanel: boolean;
  riskPanelToken: TokenWithMetrics | null;

  // Loading states
  isGlobalLoading: boolean;

  // Actions
  selectToken: (token: TokenWithMetrics | null) => void;
  openTokenDetail: (token: TokenWithMetrics) => void;
  closeTokenDetail: () => void;
  openRiskPanel: (token: TokenWithMetrics) => void;
  closeRiskPanel: () => void;
  setGlobalLoading: (loading: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedToken: null,
  isDetailOpen: false,
  showRiskPanel: false,
  riskPanelToken: null,
  isGlobalLoading: false,

  selectToken: (token) =>
    set({
      selectedToken: token,
    }),

  openTokenDetail: (token) =>
    set({
      selectedToken: token,
      isDetailOpen: true,
    }),

  closeTokenDetail: () =>
    set({
      isDetailOpen: false,
    }),

  openRiskPanel: (token) =>
    set({
      riskPanelToken: token,
      showRiskPanel: true,
    }),

  closeRiskPanel: () =>
    set({
      showRiskPanel: false,
      riskPanelToken: null,
    }),

  setGlobalLoading: (isGlobalLoading) => set({ isGlobalLoading }),
}));
