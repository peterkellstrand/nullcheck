export type SubscriptionTier = 'free' | 'pro';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

export interface SubscriptionLimits {
  watchlistTokens: number;
  chartSlots: number;
  alerts: number;
  topHolders: number;
  whaleFeedItems: number;
}

export const TIER_LIMITS: Record<SubscriptionTier, SubscriptionLimits> = {
  free: {
    watchlistTokens: 10,
    chartSlots: 4,
    alerts: 3,
    topHolders: 5,
    whaleFeedItems: 5,
  },
  pro: {
    watchlistTokens: Infinity,
    chartSlots: 16,
    alerts: Infinity,
    topHolders: 20,
    whaleFeedItems: Infinity,
  },
};

export interface UserSubscription {
  id: string;
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PriceType = 'monthly' | 'yearly';

export const PRICING = {
  monthly: {
    amount: 5,
    label: '$5/month',
  },
  yearly: {
    amount: 39,
    label: '$39/year',
    savings: '35%',
  },
} as const;
