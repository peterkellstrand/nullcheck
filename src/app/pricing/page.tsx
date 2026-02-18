'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui';
import { HUMAN_PRICING, AGENT_PRICING, TIER_LIMITS, AGENT_LIMITS } from '@/types/subscription';

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
        <h1 className="text-4xl font-bold text-[var(--text-primary)]">Pricing</h1>
        <p className="mt-2 text-neutral-400">
          Free for humans. Premium for agents.
        </p>
      </div>

      {/* =================== */}
      {/* Human Tiers Section */}
      {/* =================== */}
      <div className="mb-16">
        <h2 className="mb-6 text-2xl font-semibold text-[var(--text-primary)]">For Humans</h2>
        <p className="mb-8 text-neutral-400">
          Risk analysis should be free. These tiers are for traders using the web interface.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Free tier */}
          <div className="flex flex-col border-2 border-neutral-700 bg-[var(--bg-secondary)] p-6">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-[var(--text-primary)]">Free</h3>
              <div className="mt-2 text-3xl font-bold text-[var(--text-primary)]">$0</div>
              <div className="text-sm text-neutral-500">forever</div>
            </div>

            <ul className="mb-6 space-y-3 text-sm">
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-emerald-500">[+]</span>
                Full risk analysis
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-emerald-500">[+]</span>
                Unlimited watchlist
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-emerald-500">[+]</span>
                {TIER_LIMITS.free.chartSlots} chart slots
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-emerald-500">[+]</span>
                {TIER_LIMITS.free.alerts} price alerts
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-emerald-500">[+]</span>
                Trending tokens
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-emerald-500">[+]</span>
                Token details & holder data
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-emerald-500">[+]</span>
                Whale tracking
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-emerald-500">[+]</span>
                {TIER_LIMITS.free.manualChecksPerDay} manual checks/day
              </li>
              <li className="flex items-center gap-2 text-neutral-500">
                <span className="text-neutral-600">[-]</span>
                No API access
              </li>
              <li className="flex items-center gap-2 text-neutral-500">
                <span className="text-neutral-600">[-]</span>
                No data export
              </li>
            </ul>

            <div className="mt-auto">
              {tier === 'free' && isAuthenticated && (
                <div className="border border-neutral-700 bg-neutral-800 py-3 text-center text-sm text-neutral-400">
                  Current plan
                </div>
              )}
              {!isAuthenticated && (
                <Link href="/">
                  <Button variant="secondary" className="w-full py-3">
                    Get started free
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* PRO tier */}
          <div className="flex flex-col border-2 border-emerald-500 bg-[var(--bg-secondary)] p-6">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold text-[var(--text-primary)]">PRO</h3>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                  power user
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[var(--text-primary)]">${HUMAN_PRICING.monthly.amount}</span>
                <span className="text-neutral-500">/month</span>
              </div>
              <div className="text-sm text-emerald-400">
                or ${HUMAN_PRICING.yearly.amount}/year (save {HUMAN_PRICING.yearly.savings})
              </div>
            </div>

            <ul className="mb-6 space-y-3 text-sm">
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-emerald-500">[+]</span>
                Everything in Free
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
                {TIER_LIMITS.pro.manualChecksPerDay} manual checks/day
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-emerald-500">[+]</span>
                Export watchlist (CSV/JSON)
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-emerald-500">[+]</span>
                Historical risk data
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-emerald-500">[+]</span>
                Advanced filters
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-emerald-500">[+]</span>
                Priority email support
              </li>
              <li className="flex items-center gap-2 text-neutral-500">
                <span className="text-neutral-600">[-]</span>
                No API access (see Agent tiers)
              </li>
            </ul>

            <div className="mt-auto">
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
                          save {HUMAN_PRICING.yearly.savings}
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
        </div>
      </div>

      {/* =================== */}
      {/* Agent/API Tiers Section */}
      {/* =================== */}
      <div className="mb-16">
        <h2 className="mb-6 text-2xl font-semibold text-[var(--text-primary)]">For Agents & Bots</h2>
        <p className="mb-8 text-neutral-400">
          Programmatic API access for AI agents, trading bots, and custom integrations.
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Developer tier */}
          <div className="flex flex-col border-2 border-neutral-700 bg-[var(--bg-secondary)] p-5">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Developer</h3>
              <div className="mt-2 text-2xl font-bold text-[var(--text-primary)]">${AGENT_PRICING.developer.amount}</div>
              <div className="text-sm text-neutral-500">/month</div>
            </div>

            <ul className="mb-6 space-y-2 text-xs">
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-blue-500">[+]</span>
                {AGENT_PRICING.developer.calls} API calls/month
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-blue-500">[+]</span>
                {AGENT_LIMITS.developer.batchSize} tokens per batch
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-blue-500">[+]</span>
                {AGENT_LIMITS.developer.webhooks} webhooks
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-blue-500">[+]</span>
                {AGENT_LIMITS.developer.uptimeSla} uptime SLA
              </li>
              <li className="flex items-center gap-2 text-neutral-400">
                <span className="text-neutral-600">[~]</span>
                Overage: ${AGENT_LIMITS.developer.overagePricePerHundred}/100 calls
              </li>
            </ul>

            <div className="mt-auto">
              <a href="mailto:support@nullcheck.io?subject=Developer%20API%20Access">
                <Button variant="secondary" className="w-full py-2 text-sm">
                  Contact sales
                </Button>
              </a>
            </div>
          </div>

          {/* Professional tier */}
          <div className="flex flex-col border-2 border-blue-500 bg-[var(--bg-secondary)] p-5">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Professional</h3>
                <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
                  popular
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-[var(--text-primary)]">${AGENT_PRICING.professional.amount}</div>
              <div className="text-sm text-neutral-500">/month</div>
            </div>

            <ul className="mb-6 space-y-2 text-xs">
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-blue-500">[+]</span>
                {AGENT_PRICING.professional.calls} API calls/month
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-blue-500">[+]</span>
                {AGENT_LIMITS.professional.batchSize} tokens per batch
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-blue-500">[+]</span>
                Unlimited webhooks
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-blue-500">[+]</span>
                {AGENT_LIMITS.professional.uptimeSla} uptime SLA
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-blue-500">[+]</span>
                Priority support
              </li>
              <li className="flex items-center gap-2 text-neutral-400">
                <span className="text-neutral-600">[~]</span>
                Overage: ${AGENT_LIMITS.professional.overagePricePerHundred}/100 calls
              </li>
            </ul>

            <div className="mt-auto">
              <a href="mailto:support@nullcheck.io?subject=Professional%20API%20Access">
                <Button className="w-full border-2 border-blue-500 bg-blue-500/20 py-2 text-sm text-blue-400 hover:bg-blue-500/30">
                  Contact sales
                </Button>
              </a>
            </div>
          </div>

          {/* Business tier */}
          <div className="flex flex-col border-2 border-neutral-700 bg-[var(--bg-secondary)] p-5">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Business</h3>
              <div className="mt-2 text-2xl font-bold text-[var(--text-primary)]">${AGENT_PRICING.business.amount}</div>
              <div className="text-sm text-neutral-500">/month</div>
            </div>

            <ul className="mb-6 space-y-2 text-xs">
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-violet-500">[+]</span>
                {AGENT_PRICING.business.calls} API calls/month
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-violet-500">[+]</span>
                {AGENT_LIMITS.business.batchSize} tokens per batch
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-violet-500">[+]</span>
                Unlimited webhooks
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-violet-500">[+]</span>
                {AGENT_LIMITS.business.uptimeSla} uptime SLA
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-violet-500">[+]</span>
                Dedicated support
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-violet-500">[+]</span>
                Custom integrations
              </li>
              <li className="flex items-center gap-2 text-neutral-400">
                <span className="text-neutral-600">[~]</span>
                Overage: ${AGENT_LIMITS.business.overagePricePerHundred}/100 calls
              </li>
            </ul>

            <div className="mt-auto">
              <a href="mailto:support@nullcheck.io?subject=Business%20API%20Access">
                <Button variant="secondary" className="w-full py-2 text-sm">
                  Contact sales
                </Button>
              </a>
            </div>
          </div>

          {/* Enterprise tier */}
          <div className="flex flex-col border-2 border-neutral-700 bg-[var(--bg-secondary)] p-5">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Enterprise</h3>
              <div className="mt-2 text-2xl font-bold text-[var(--text-primary)]">Custom</div>
              <div className="text-sm text-neutral-500">contact us</div>
            </div>

            <ul className="mb-6 space-y-2 text-xs">
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-amber-500">[+]</span>
                {AGENT_PRICING.enterprise.calls} API calls/month
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-amber-500">[+]</span>
                White-label options
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-amber-500">[+]</span>
                Dedicated infrastructure
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-amber-500">[+]</span>
                Custom SLA
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-amber-500">[+]</span>
                Account manager
              </li>
              <li className="flex items-center gap-2 text-neutral-300">
                <span className="text-amber-500">[+]</span>
                {AGENT_LIMITS.enterprise.uptimeSla} uptime SLA
              </li>
            </ul>

            <div className="mt-auto">
              <a href="mailto:enterprise@nullcheck.io?subject=Enterprise%20API%20Access">
                <Button variant="secondary" className="w-full py-2 text-sm">
                  Contact sales
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* =================== */}
      {/* Comparison Table */}
      {/* =================== */}
      <div className="mb-16">
        <h2 className="mb-6 text-xl font-semibold text-[var(--text-primary)]">Feature Comparison</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-700">
                <th className="py-3 text-left text-neutral-400 font-medium">Feature</th>
                <th className="py-3 text-center text-neutral-400 font-medium">Free</th>
                <th className="py-3 text-center text-emerald-400 font-medium">PRO</th>
                <th className="py-3 text-center text-blue-400 font-medium">API Tiers</th>
              </tr>
            </thead>
            <tbody className="text-neutral-300">
              <tr className="border-b border-neutral-800">
                <td className="py-3">Risk Analysis</td>
                <td className="py-3 text-center text-emerald-500">Full</td>
                <td className="py-3 text-center text-emerald-500">Full</td>
                <td className="py-3 text-center text-emerald-500">Full</td>
              </tr>
              <tr className="border-b border-neutral-800">
                <td className="py-3">Watchlist</td>
                <td className="py-3 text-center">Unlimited</td>
                <td className="py-3 text-center">Unlimited</td>
                <td className="py-3 text-center text-neutral-500">N/A</td>
              </tr>
              <tr className="border-b border-neutral-800">
                <td className="py-3">Chart Slots</td>
                <td className="py-3 text-center">9</td>
                <td className="py-3 text-center">16</td>
                <td className="py-3 text-center text-neutral-500">N/A</td>
              </tr>
              <tr className="border-b border-neutral-800">
                <td className="py-3">Price Alerts</td>
                <td className="py-3 text-center">10</td>
                <td className="py-3 text-center">Unlimited</td>
                <td className="py-3 text-center text-neutral-500">N/A</td>
              </tr>
              <tr className="border-b border-neutral-800">
                <td className="py-3">Manual Checks/Day</td>
                <td className="py-3 text-center">50</td>
                <td className="py-3 text-center">200</td>
                <td className="py-3 text-center text-neutral-500">N/A</td>
              </tr>
              <tr className="border-b border-neutral-800">
                <td className="py-3">Data Export</td>
                <td className="py-3 text-center text-neutral-500">No</td>
                <td className="py-3 text-center text-emerald-500">Yes</td>
                <td className="py-3 text-center text-emerald-500">Yes</td>
              </tr>
              <tr className="border-b border-neutral-800">
                <td className="py-3">Historical Data</td>
                <td className="py-3 text-center text-neutral-500">No</td>
                <td className="py-3 text-center text-emerald-500">Yes</td>
                <td className="py-3 text-center text-emerald-500">Yes</td>
              </tr>
              <tr className="border-b border-neutral-800">
                <td className="py-3">API Access</td>
                <td className="py-3 text-center text-neutral-500">No</td>
                <td className="py-3 text-center text-neutral-500">No</td>
                <td className="py-3 text-center text-emerald-500">Yes</td>
              </tr>
              <tr className="border-b border-neutral-800">
                <td className="py-3">Webhooks</td>
                <td className="py-3 text-center text-neutral-500">No</td>
                <td className="py-3 text-center text-neutral-500">No</td>
                <td className="py-3 text-center text-emerald-500">Yes</td>
              </tr>
              <tr className="border-b border-neutral-800">
                <td className="py-3">Batch Operations</td>
                <td className="py-3 text-center text-neutral-500">No</td>
                <td className="py-3 text-center text-neutral-500">No</td>
                <td className="py-3 text-center text-emerald-500">Yes</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="border-t border-neutral-800 pt-12">
        <h2 className="mb-6 text-xl font-semibold text-[var(--text-primary)]">FAQ</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-medium text-[var(--text-primary)]">Why is the free tier so generous?</h3>
            <p className="mt-1 text-sm text-neutral-400">
              We believe risk analysis should be free for everyone. Human users sharing our data creates trust and awareness. Our revenue comes from agents and bots who need API access.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-[var(--text-primary)]">Can I use the free tier for my trading bot?</h3>
            <p className="mt-1 text-sm text-neutral-400">
              No. The free tier is for manual web UI usage only. Bots and scripts require an API subscription. We detect and block automated access on free accounts.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-[var(--text-primary)]">What counts as an API call?</h3>
            <p className="mt-1 text-sm text-neutral-400">
              Each request to any API endpoint counts as one call. Batch requests count as one call regardless of how many tokens are analyzed.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-[var(--text-primary)]">What happens if I exceed my API limit?</h3>
            <p className="mt-1 text-sm text-neutral-400">
              Overages are billed at the rate shown for your tier. You can set spending limits in your dashboard to avoid surprises.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-[var(--text-primary)]">Can I cancel anytime?</h3>
            <p className="mt-1 text-sm text-neutral-400">
              Yes. Cancel from the customer portal. You&apos;ll keep access until the end of your billing period.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-[var(--text-primary)]">Will you ever promote tokens?</h3>
            <p className="mt-1 text-sm text-neutral-400">
              Never. nullcheck will never accept payment from token projects. Our revenue comes from users, keeping our analysis unbiased.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary)] p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-[var(--text-primary)] hover:text-neutral-300">
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
