import type { PriceType } from '@/types/subscription';

export const STRIPE_CONFIG = {
  prices: {
    // Human PRO tier
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY!,
    // Agent tiers
    developer: process.env.STRIPE_PRICE_DEVELOPER!,
    professional: process.env.STRIPE_PRICE_PROFESSIONAL!,
    business: process.env.STRIPE_PRICE_BUSINESS!,
  },
  // Overage meter prices (for metered billing)
  overagePrices: {
    professional: process.env.STRIPE_PRICE_PROFESSIONAL_OVERAGE,
    business: process.env.STRIPE_PRICE_BUSINESS_OVERAGE,
  },
  successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?success=true`,
  cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
  portalReturnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
} as const;

export function getPriceId(priceType: PriceType): string {
  return STRIPE_CONFIG.prices[priceType];
}

export function isAgentTier(priceType: PriceType): boolean {
  return ['developer', 'professional', 'business'].includes(priceType);
}
