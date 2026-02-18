// ===================
// Human Subscription Tiers
// ===================

export type SubscriptionTier = 'free' | 'pro';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

export interface SubscriptionLimits {
  watchlistTokens: number;
  chartSlots: number;
  alerts: number;
  topHolders: number;
  whaleFeedItems: number;
  manualChecksPerDay: number;
  hasApiAccess: boolean;
  hasExport: boolean;
  hasHistoricalData: boolean;
  hasAdvancedFilters: boolean;
  hasPrioritySupport: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, SubscriptionLimits> = {
  free: {
    watchlistTokens: Infinity,
    chartSlots: 9,
    alerts: 10,
    topHolders: 20,
    whaleFeedItems: Infinity,
    manualChecksPerDay: 50,
    hasApiAccess: false,
    hasExport: false,
    hasHistoricalData: false,
    hasAdvancedFilters: false,
    hasPrioritySupport: false,
  },
  pro: {
    watchlistTokens: Infinity,
    chartSlots: 16,
    alerts: Infinity,
    topHolders: 20,
    whaleFeedItems: Infinity,
    manualChecksPerDay: 200,
    hasApiAccess: false, // PRO humans still don't get API access - that's for Agent tiers
    hasExport: true,
    hasHistoricalData: true,
    hasAdvancedFilters: true,
    hasPrioritySupport: true,
  },
};

// ===================
// Agent/API Subscription Tiers
// ===================

export type AgentTier = 'developer' | 'professional' | 'business' | 'enterprise';

export interface AgentLimits {
  apiCallsPerMonth: number;
  batchSize: number;
  webhooks: number;
  price: number;
  label: string;
  overageEnabled: boolean;
  overagePricePerHundred: number; // USD per 100 requests over limit
  uptimeSla: string;
  hasDedicatedSupport: boolean;
  hasCustomIntegrations: boolean;
}

export const AGENT_LIMITS: Record<AgentTier, AgentLimits> = {
  developer: {
    apiCallsPerMonth: 10000,
    batchSize: 10,
    webhooks: 5,
    price: 49,
    label: 'Developer',
    overageEnabled: true,
    overagePricePerHundred: 0.015, // $0.015 per 100 calls
    uptimeSla: '99%',
    hasDedicatedSupport: false,
    hasCustomIntegrations: false,
  },
  professional: {
    apiCallsPerMonth: 100000,
    batchSize: 50,
    webhooks: Infinity,
    price: 199,
    label: 'Professional',
    overageEnabled: true,
    overagePricePerHundred: 0.012, // $0.012 per 100 calls
    uptimeSla: '99.5%',
    hasDedicatedSupport: false,
    hasCustomIntegrations: false,
  },
  business: {
    apiCallsPerMonth: 500000,
    batchSize: 100,
    webhooks: Infinity,
    price: 499,
    label: 'Business',
    overageEnabled: true,
    overagePricePerHundred: 0.010, // $0.010 per 100 calls
    uptimeSla: '99.9%',
    hasDedicatedSupport: true,
    hasCustomIntegrations: true,
  },
  enterprise: {
    apiCallsPerMonth: Infinity, // Custom
    batchSize: 100,
    webhooks: Infinity,
    price: 0, // Custom pricing
    label: 'Enterprise',
    overageEnabled: false, // Custom arrangement
    overagePricePerHundred: 0,
    uptimeSla: '99.95%',
    hasDedicatedSupport: true,
    hasCustomIntegrations: true,
  },
};

// ===================
// API Key Types
// ===================

export interface ApiKey {
  id: string;
  userId: string;
  apiKey: string;
  name: string;
  tier: AgentTier;
  monthlyLimit: number;
  createdAt: string;
  lastUsed: string | null;
  isRevoked: boolean;
}

// ===================
// User Subscription Types
// ===================

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

// ===================
// Pricing Constants
// ===================

export type PriceType = 'monthly' | 'yearly' | 'developer' | 'professional' | 'business';

// Human PRO pricing
export const HUMAN_PRICING = {
  monthly: {
    amount: 10,
    label: '$10/month',
  },
  yearly: {
    amount: 96, // $8/month effective
    label: '$96/year',
    savings: '20%',
  },
} as const;

// Agent API pricing
export const AGENT_PRICING = {
  developer: {
    amount: 49,
    label: '$49/month',
    calls: '10,000',
  },
  professional: {
    amount: 199,
    label: '$199/month',
    calls: '100,000',
  },
  business: {
    amount: 499,
    label: '$499/month',
    calls: '500,000',
  },
  enterprise: {
    amount: null,
    label: 'Custom',
    calls: '1M+',
  },
} as const;

// Legacy export for backwards compatibility
export const PRICING = HUMAN_PRICING;
