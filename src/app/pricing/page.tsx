'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui';
import { PRICING, TIER_LIMITS } from '@/types/subscription';

function PricingContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success') === 'true';
  const canceled = searchParams.get('canceled') === 'true';

  const { isAuthenticated } = useAuth();
  const { tier, isPro, openCheckout, openPortal, isLoading: subLoading } = useSubscription();
  const [isLoading, setIsLoading] = useState<'monthly' | 'yearly' | 'portal' | null>(null);

  const handleCheckout = async (priceType: 'monthly' | 'yearly') => {
    setIsLoading(priceType);
    await openCheckout(priceType);
  };

  const handlePortal = async () => {
    setIsLoading('portal');
    await openPortal();
  };

  return (
    <>
      {/* Success/Cancel messages */}
      {success && (
        <div className="mb-8 border-2 border-emerald-500 bg-emerald-500/10 p-4 text-emerald-400">
          Welcome to PRO! Your subscription is now active.
        </div>
      )}
      {canceled && (
        <div className="mb-8 border-2 border-yellow-500 bg-yellow-500/10 p-4 text-yellow-400">
          Checkout canceled. No charges were made.
        </div>
      )}

      {/* Title */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-white">Pricing</h1>
        <p className="mt-2 text-neutral-400">
          Zero promoted tokens. Ever.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Free tier */}
        <div className="border-2 border-neutral-700 bg-neutral-900 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white">Free</h2>
            <div className="mt-2 text-3xl font-bold text-white">$0</div>
            <div className="text-sm text-neutral-500">forever</div>
          </div>

          <ul className="mb-6 space-y-3 text-sm">
            <li className="flex items-center gap-2 text-neutral-300">
              <span className="text-neutral-500">[+]</span>
              {TIER_LIMITS.free.watchlistTokens} watchlist tokens
            </li>
            <li className="flex items-center gap-2 text-neutral-300">
              <span className="text-neutral-500">[+]</span>
              {TIER_LIMITS.free.chartSlots} chart slots
            </li>
            <li className="flex items-center gap-2 text-neutral-300">
              <span className="text-neutral-500">[+]</span>
              {TIER_LIMITS.free.alerts} alerts
            </li>
            <li className="flex items-center gap-2 text-neutral-300">
              <span className="text-neutral-500">[+]</span>
              Real-time price streaming
            </li>
            <li className="flex items-center gap-2 text-neutral-300">
              <span className="text-neutral-500">[+]</span>
              Risk analysis
            </li>
          </ul>

          {tier === 'free' && isAuthenticated && (
            <div className="border border-neutral-700 bg-neutral-800 py-3 text-center text-sm text-neutral-400">
              Current plan
            </div>
          )}
          {!isAuthenticated && (
            <Link href="/">
              <Button variant="secondary" className="w-full py-3">
                Get started
              </Button>
            </Link>
          )}
        </div>

        {/* PRO tier */}
        <div className="border-2 border-emerald-500 bg-neutral-900 p-6">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-white">PRO</h2>
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                recommended
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">${PRICING.yearly.amount}</span>
              <span className="text-neutral-500">/year</span>
            </div>
            <div className="text-sm text-emerald-400">
              or ${PRICING.monthly.amount}/month
            </div>
          </div>

          <ul className="mb-6 space-y-3 text-sm">
            <li className="flex items-center gap-2 text-neutral-300">
              <span className="text-emerald-500">[+]</span>
              Unlimited watchlist tokens
            </li>
            <li className="flex items-center gap-2 text-neutral-300">
              <span className="text-emerald-500">[+]</span>
              {TIER_LIMITS.pro.chartSlots} chart slots
            </li>
            <li className="flex items-center gap-2 text-neutral-300">
              <span className="text-emerald-500">[+]</span>
              Unlimited alerts
            </li>
            <li className="flex items-center gap-2 text-neutral-300">
              <span className="text-emerald-500">[+]</span>
              API keys for agents/bots
            </li>
            <li className="flex items-center gap-2 text-neutral-300">
              <span className="text-emerald-500">[+]</span>
              {TIER_LIMITS.pro.topHolders} whale holders shown
            </li>
            <li className="flex items-center gap-2 text-neutral-300">
              <span className="text-emerald-500">[+]</span>
              Everything in Free
            </li>
          </ul>

          {isPro ? (
            <Button
              onClick={handlePortal}
              disabled={isLoading !== null || subLoading}
              variant="secondary"
              className="w-full py-3"
            >
              {isLoading === 'portal' ? 'Loading...' : 'Manage subscription'}
            </Button>
          ) : isAuthenticated ? (
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => handleCheckout('yearly')}
                disabled={isLoading !== null || subLoading}
                className="w-full border-2 border-emerald-500 bg-emerald-500/20 py-3 text-emerald-400 hover:bg-emerald-500/30"
              >
                {isLoading === 'yearly' ? 'Loading...' : (
                  <>
                    Subscribe yearly
                    <span className="ml-2 rounded bg-emerald-500/30 px-2 py-0.5 text-xs">
                      save {PRICING.yearly.savings}
                    </span>
                  </>
                )}
              </Button>
              <Button
                onClick={() => handleCheckout('monthly')}
                disabled={isLoading !== null || subLoading}
                variant="secondary"
                className="w-full py-3"
              >
                {isLoading === 'monthly' ? 'Loading...' : 'Subscribe monthly'}
              </Button>
            </div>
          ) : (
            <Link href="/">
              <Button className="w-full border-2 border-emerald-500 bg-emerald-500/20 py-3 text-emerald-400 hover:bg-emerald-500/30">
                Sign in to subscribe
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-12 border-t border-neutral-800 pt-12">
        <h2 className="mb-6 text-xl font-semibold text-white">FAQ</h2>
        <div className="space-y-6">
          <div>
            <h3 className="font-medium text-white">Can I cancel anytime?</h3>
            <p className="mt-1 text-sm text-neutral-400">
              Yes. Cancel anytime from the customer portal. You&apos;ll keep PRO access until the end of your billing period.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-white">What payment methods are accepted?</h3>
            <p className="mt-1 text-sm text-neutral-400">
              All major credit cards via Stripe. No crypto payments at this time.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-white">Will you ever promote tokens?</h3>
            <p className="mt-1 text-sm text-neutral-400">
              No. nullcheck will never accept payment from token projects. Our revenue comes from users, keeping our analysis unbiased.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-white">What are API keys for?</h3>
            <p className="mt-1 text-sm text-neutral-400">
              PRO subscribers can create API keys for AI agents, trading bots, or scripts to access nullcheck data programmatically. Basic keys include 5,000 calls/day, Pro keys include 100,000 calls/day.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-black p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-white hover:text-neutral-300">
            null//check
          </Link>
        </div>

        <Suspense fallback={
          <div className="text-center text-neutral-500">Loading...</div>
        }>
          <PricingContent />
        </Suspense>
      </div>
    </main>
  );
}
