'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { AGENT_PRICING, AGENT_LIMITS } from '@/types/subscription';

export default function ApiKeysPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="w-full max-w-[1030px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/"
          className="text-neutral-500 hover:text-[var(--text-primary)] text-sm transition-colors"
        >
          &larr; back
        </Link>
      </div>

      {/* Main Container */}
      <div className="border-2 border-[var(--border)] bg-[var(--bg-primary)]">
        {/* Title */}
        <div className="p-6 border-b border-[var(--border)]">
          <h1 className="text-xl text-[var(--text-primary)] mb-2">API Access</h1>
          <p className="text-sm text-neutral-400">
            Programmatic access for AI agents, trading bots, and custom integrations.
          </p>
        </div>

        {/* Info Message */}
        <div className="p-6 border-b border-[var(--border)] bg-blue-950/20">
          <div className="flex items-start gap-3">
            <span className="text-blue-400 text-lg">i</span>
            <div>
              <p className="text-blue-300 text-sm mb-2">
                API access requires a separate subscription from our Agent tiers.
              </p>
              <p className="text-neutral-400 text-sm">
                Human subscriptions (Free and PRO) do not include API access. This is intentional &mdash;
                our free tier is for manual web usage only, while API access is for automated systems.
              </p>
            </div>
          </div>
        </div>

        {/* API Tiers */}
        <div className="p-6">
          <h2 className="text-sm text-neutral-400 mb-4">Available API Tiers</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Developer */}
            <div className="p-4 border border-neutral-700 bg-neutral-900/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--text-primary)] font-medium">Developer</span>
                <span className="text-blue-400 font-bold">${AGENT_PRICING.developer.amount}/mo</span>
              </div>
              <ul className="text-xs text-neutral-400 space-y-1">
                <li>{AGENT_PRICING.developer.calls} API calls/month</li>
                <li>{AGENT_LIMITS.developer.batchSize} tokens per batch</li>
                <li>{AGENT_LIMITS.developer.webhooks} webhooks</li>
                <li>{AGENT_LIMITS.developer.uptimeSla} uptime SLA</li>
              </ul>
            </div>

            {/* Professional */}
            <div className="p-4 border border-blue-700 bg-blue-900/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-primary)] font-medium">Professional</span>
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">popular</span>
                </div>
                <span className="text-blue-400 font-bold">${AGENT_PRICING.professional.amount}/mo</span>
              </div>
              <ul className="text-xs text-neutral-400 space-y-1">
                <li>{AGENT_PRICING.professional.calls} API calls/month</li>
                <li>{AGENT_LIMITS.professional.batchSize} tokens per batch</li>
                <li>Unlimited webhooks</li>
                <li>{AGENT_LIMITS.professional.uptimeSla} uptime SLA</li>
                <li>Priority support</li>
              </ul>
            </div>

            {/* Business */}
            <div className="p-4 border border-neutral-700 bg-neutral-900/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--text-primary)] font-medium">Business</span>
                <span className="text-violet-400 font-bold">${AGENT_PRICING.business.amount}/mo</span>
              </div>
              <ul className="text-xs text-neutral-400 space-y-1">
                <li>{AGENT_PRICING.business.calls} API calls/month</li>
                <li>{AGENT_LIMITS.business.batchSize} tokens per batch</li>
                <li>Unlimited webhooks</li>
                <li>{AGENT_LIMITS.business.uptimeSla} uptime SLA</li>
                <li>Dedicated support & custom integrations</li>
              </ul>
            </div>

            {/* Enterprise */}
            <div className="p-4 border border-neutral-700 bg-neutral-900/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--text-primary)] font-medium">Enterprise</span>
                <span className="text-amber-400 font-bold">Custom</span>
              </div>
              <ul className="text-xs text-neutral-400 space-y-1">
                <li>1M+ API calls/month</li>
                <li>White-label options</li>
                <li>Dedicated infrastructure</li>
                <li>{AGENT_LIMITS.enterprise.uptimeSla} uptime SLA</li>
                <li>Account manager</li>
              </ul>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center p-6 border border-neutral-800 bg-neutral-900/30">
            <p className="text-neutral-300 mb-4">
              Ready to integrate null//check into your bot or agent?
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="mailto:support@nullcheck.io?subject=API%20Access%20Inquiry"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors inline-block"
              >
                Contact Sales
              </a>
              <Link
                href="/docs"
                className="px-6 py-2 border border-neutral-600 hover:border-neutral-500 text-neutral-300 text-sm transition-colors inline-block"
              >
                View API Docs
              </Link>
            </div>
          </div>
        </div>

        {/* Authentication Note */}
        <div className="p-6 border-t border-neutral-800 bg-neutral-900/30">
          <h2 className="text-sm text-neutral-400 mb-3">How API Access Works</h2>
          <div className="text-xs text-neutral-500 space-y-2">
            <p>
              <span className="text-neutral-300">1.</span> Contact our sales team to discuss your needs and select a tier.
            </p>
            <p>
              <span className="text-neutral-300">2.</span> Once subscribed, you&apos;ll receive API keys that can be managed from this page.
            </p>
            <p>
              <span className="text-neutral-300">3.</span> Include your API key via the{' '}
              <code className="px-1 py-0.5 bg-neutral-800 text-blue-400">X-API-Key</code> header or{' '}
              <code className="px-1 py-0.5 bg-neutral-800 text-blue-400">?api_key=</code> query parameter.
            </p>
            <p>
              <span className="text-neutral-300">Example:</span>{' '}
              <code className="px-1 py-0.5 bg-neutral-800 text-neutral-300">
                curl -H &quot;X-API-Key: nk_...&quot; https://api.nullcheck.io/api/tokens
              </code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
