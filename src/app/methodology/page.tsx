'use client';

import Link from 'next/link';

export default function MethodologyPage() {
  return (
    <div className="w-full max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Link
          href="/"
          className="text-neutral-500 hover:text-[var(--text-primary)] text-sm transition-colors"
        >
          &larr; back
        </Link>
      </div>

      {/* Main Content */}
      <div className="border-2 border-[var(--border)] bg-[var(--bg-primary)]">
        {/* Title + Score Legend */}
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl text-[var(--text-primary)]">risk methodology</h1>
            <p className="text-xs text-neutral-500">how we analyze token risk (0-100 scale)</p>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 bg-green-500/10 text-green-500 border border-green-500/30">0-14 low</span>
            <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/30">15-29 med</span>
            <span className="px-2 py-1 bg-orange-500/10 text-orange-500 border border-orange-500/30">30-49 high</span>
            <span className="px-2 py-1 bg-red-500/10 text-red-500 border border-red-500/30">50+ crit</span>
          </div>
        </div>

        {/* Risk Categories Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--border)]">
          {/* Honeypot */}
          <div className="bg-[var(--bg-primary)] p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm text-[var(--text-primary)]">honeypot risk</h3>
              <span className="text-xs text-neutral-600">max 50 pts</span>
            </div>
            <p className="text-xs text-neutral-500 mb-2">Can you actually sell?</p>
            <div className="space-y-1 text-xs">
              <Row s="crit" p={50} t="Honeypot detected" />
              <Row s="crit" p={40} t="Cannot sell all tokens" />
              <Row s="crit" p={30} t="Sell tax >50%" />
              <Row s="high" p={15} t="Sell tax 20-50%" />
              <Row s="med" p={5} t="Sell tax 10-20%" />
              <Row s="high" p={10} t="Buy tax >20%" />
            </div>
          </div>

          {/* Contract */}
          <div className="bg-[var(--bg-primary)] p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm text-[var(--text-primary)]">contract risk</h3>
              <span className="text-xs text-neutral-600">max 30 pts</span>
            </div>
            <p className="text-xs text-neutral-500 mb-2">Dangerous contract functions</p>
            <div className="space-y-1 text-xs">
              <Row s="crit" p={20} t="Owner can modify balances" />
              <Row s="crit" p={15} t="Can reclaim ownership" />
              <Row s="high" p={15} t="Source not verified" />
              <Row s="high" p={10} t="Mintable / modifiable tax" />
              <Row s="high" p={10} t="Hidden owner" />
              <Row s="med" p={5} t="Proxy / pausable / blacklist" />
            </div>
          </div>

          {/* Holders */}
          <div className="bg-[var(--bg-primary)] p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm text-[var(--text-primary)]">holder risk</h3>
              <span className="text-xs text-neutral-600">max 25 pts</span>
            </div>
            <p className="text-xs text-neutral-500 mb-2">Token distribution</p>
            <div className="space-y-1 text-xs">
              <Row s="crit" p={15} t="Top 10 hold >80%" />
              <Row s="high" p={10} t="Top 10 hold 60-80%" />
              <Row s="high" p={10} t="<50 holders" />
              <Row s="high" p={10} t="Creator holds >20%" />
              <Row s="med" p={5} t="Top 10 hold 40-60%" />
              <Row s="med" p={5} t="<200 holders" />
            </div>
          </div>

          {/* Liquidity */}
          <div className="bg-[var(--bg-primary)] p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm text-[var(--text-primary)]">liquidity risk</h3>
              <span className="text-xs text-neutral-600">max 25 pts</span>
            </div>
            <p className="text-xs text-neutral-500 mb-2">LP depth and security</p>
            <div className="space-y-1 text-xs">
              <Row s="crit" p={15} t="Liquidity <$10k" />
              <Row s="high" p={10} t="Liquidity $10k-$50k" />
              <Row s="high" p={10} t="<50% LP locked" />
              <Row s="med" p={5} t="Liquidity $50k-$100k" />
              <Row s="med" p={5} t="50-80% LP locked" />
            </div>
          </div>
        </div>

        {/* Footer: Sources + Formula + Disclaimer */}
        <div className="p-4 border-t border-[var(--border)] text-xs">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-neutral-500">
            <div>
              <span className="text-neutral-400">sources:</span> GoPlus, Helius, DexScreener
            </div>
            <div>
              <span className="text-neutral-400">formula:</span>{' '}
              <code className="text-neutral-300">min((honeypot + contract + holders + liquidity) / 130 * 100, 100)</code>
            </div>
          </div>
          <p className="mt-2 text-neutral-600">
            * Low score does not guarantee safety. Not financial advice. DYOR.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ s, p, t }: { s: 'crit' | 'high' | 'med' | 'low'; p: number; t: string }) {
  const colors = {
    crit: 'text-red-500',
    high: 'text-orange-500',
    med: 'text-yellow-500',
    low: 'text-green-500',
  };
  return (
    <div className="flex items-center gap-2">
      <span className={`w-8 ${colors[s]}`}>{s}</span>
      <span className="w-8 text-neutral-600">+{p}</span>
      <span className="text-neutral-400">{t}</span>
    </div>
  );
}
