export type SubscriptionTier = 'free' | 'pro';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';
export type AgentTier = 'agent_basic' | 'agent_pro';

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
  agent_basic: {
    apiCallsPerDay: 5000,
    batchSize: 10,
  },
  agent_pro: {
    apiCallsPerDay: Infinity,
    batchSize: 100,
  },
};

export interface ApiKey {
  id: string;
  userId: string;
  apiKey: string;
  name: string;
  tier: 'basic' | 'pro';
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
