'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  type SubscriptionTier,
  type SubscriptionLimits,
  type UserSubscription,
  type PriceType,
  TIER_LIMITS,
} from '@/types/subscription';

interface SubscriptionContextValue {
  tier: SubscriptionTier;
  limits: SubscriptionLimits;
  subscription: UserSubscription | null;
  isPro: boolean;
  isFree: boolean;
  isLoading: boolean;
  canAddToWatchlist: (currentCount: number) => boolean;
  canAddChart: (currentCount: number) => boolean;
  openCheckout: (priceType: PriceType) => Promise<void>;
  openPortal: () => Promise<void>;
  refetch: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSubscription = useCallback(async () => {
    if (!isAuthenticated) {
      setTier('free');
      setSubscription(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/subscription');
      if (response.ok) {
        const data = await response.json();
        setTier(data.tier);
        setSubscription(data.subscription);
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription, user?.id]);

  const limits = TIER_LIMITS[tier];
  const isPro = tier === 'pro';
  const isFree = tier === 'free';

  const canAddToWatchlist = useCallback(
    (currentCount: number) => currentCount < limits.watchlistTokens,
    [limits.watchlistTokens]
  );

  const canAddChart = useCallback(
    (currentCount: number) => currentCount < limits.chartSlots,
    [limits.chartSlots]
  );

  const openCheckout = useCallback(async (priceType: PriceType) => {
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceType }),
      });

      const data = await response.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        console.error('Checkout failed:', data.error);
      }
    } catch (error) {
      console.error('Checkout error:', error);
    }
  }, []);

  const openPortal = useCallback(async () => {
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      });

      const data = await response.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        console.error('Portal failed:', data.error);
      }
    } catch (error) {
      console.error('Portal error:', error);
    }
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        tier,
        limits,
        subscription,
        isPro,
        isFree,
        isLoading,
        canAddToWatchlist,
        canAddChart,
        openCheckout,
        openPortal,
        refetch: fetchSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscriptionContext must be used within SubscriptionProvider');
  }
  return context;
}
