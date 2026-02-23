'use client';

import { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui';
import { PRICING } from '@/types/subscription';

interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  feature: 'watchlist' | 'charts' | 'alerts';
  currentCount: number;
  limit: number;
}

const FEATURE_LABELS = {
  watchlist: 'watchlist tokens',
  charts: 'chart slots',
  alerts: 'alerts',
};

export function UpgradePrompt({
  isOpen,
  onClose,
  feature,
  currentCount,
  limit,
}: UpgradePromptProps) {
  const { openCheckout } = useSubscription();
  const [isLoading, setIsLoading] = useState<'monthly' | 'yearly' | null>(null);

  if (!isOpen) return null;

  const handleCheckout = async (priceType: 'monthly' | 'yearly') => {
    setIsLoading(priceType);
    await openCheckout(priceType);
    // Will redirect, so no need to reset loading state
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md border-2 border-neutral-700 bg-neutral-900 p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-neutral-500 hover:text-neutral-300"
        >
          [x]
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white">
            Upgrade to PRO
          </h2>
          <p className="mt-2 text-neutral-400">
            You&apos;ve reached your free tier limit of {limit} {FEATURE_LABELS[feature]}.
            Currently using {currentCount}/{limit}.
          </p>
        </div>

        {/* PRO Benefits */}
        <div className="mb-6 border border-neutral-700 bg-neutral-800/50 p-4">
          <div className="mb-3 text-sm font-medium text-emerald-400">
            PRO includes:
          </div>
          <ul className="space-y-2 text-sm text-neutral-300">
            <li>+ Unlimited watchlist tokens</li>
            <li>+ 16 chart slots</li>
            <li>+ Unlimited price alerts</li>
          </ul>
        </div>

        {/* Pricing buttons */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => handleCheckout('yearly')}
            disabled={isLoading !== null}
            className="w-full border-2 border-emerald-500 bg-emerald-500/20 py-3 text-emerald-400 hover:bg-emerald-500/30"
          >
            {isLoading === 'yearly' ? 'Loading...' : (
              <>
                {PRICING.yearly.label}
                <span className="ml-2 rounded bg-emerald-500/30 px-2 py-0.5 text-xs">
                  save {PRICING.yearly.savings}
                </span>
              </>
            )}
          </Button>

          <Button
            onClick={() => handleCheckout('monthly')}
            disabled={isLoading !== null}
            variant="secondary"
            className="w-full py-3"
          >
            {isLoading === 'monthly' ? 'Loading...' : PRICING.monthly.label}
          </Button>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-neutral-500">
          Cancel anytime. Secure payment via Stripe.
        </p>
      </div>
    </div>
  );
}
