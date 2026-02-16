export type SubscriptionTier = 'free' | 'pro';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';
export type AgentTier = 'starter' | 'builder' | 'scale';

export interface SubscriptionLimits {
  watchlistTokens: number;
  chartSlots: number;
  alerts: number;
  topHolders: number;
  whaleFeedItems: number;
}

export interface AgentLimits {
  apiCallsPerDay: number;
  batchSize: number;
  price: number;
  label: string;
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

export const AGENT_LIMITS: Record<AgentTier, AgentLimits> = {
  starter: {
    apiCallsPerDay: 10000,
    batchSize: 10,
    price: 0,
    label: 'Starter',
  },
  builder: {
    apiCallsPerDay: 100000,
    batchSize: 50,
    price: 19,
    label: 'Builder',
  },
  scale: {
    apiCallsPerDay: 1000000,
    batchSize: 100,
    price: 49,
    label: 'Scale',
  },
};

export interface ApiKey {
  id: string;
  userId: string;
  apiKey: string;
  name: string;
  tier: AgentTier;
  dailyLimit: number;
  createdAt: string;
  lastUsed: string | null;
  isRevoked: boolean;
}

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
