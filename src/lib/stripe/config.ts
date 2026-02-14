import type { PriceType } from '@/types/subscription';

export const STRIPE_CONFIG = {
  prices: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY!,
  },
  successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?success=true`,
  cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
  portalReturnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
} as const;

export function getPriceId(priceType: PriceType): string {
  return STRIPE_CONFIG.prices[priceType];
}
