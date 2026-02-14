'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChainId, CHAINS } from '@/types/chain';
import { TokenWithMetrics } from '@/types/token';
import { RiskScore } from '@/types/risk';
import { RiskPanel } from '@/components/risk/RiskPanel';
import { PriceChart } from '@/components/charts/PriceChart';
import { TopHoldersPanel, WhaleActivityFeed } from '@/components/whale';
import { formatPrice, formatNumber, formatPercent } from '@/lib/utils/format';

export default function TokenDetailPage() {
  const params = useParams();
  const router = useRouter();
  const chain = params.chain as ChainId;
  const address = params.address as string;

  const [token, setToken] = useState<TokenWithMetrics | null>(null);
  const [risk, setRisk] = useState<RiskScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchToken() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch token data
        const response = await fetch(`/api/token/${chain}/${address}`);
        const data = await response.json();

        if (data.success && data.token) {
          setToken(data.token);

          // Fetch risk score
          if (data.token.risk) {
            setRisk(data.token.risk);
          } else {
            fetchRiskScore();
          }
        } else {
          setError(data.error || 'Token not found');
        }
      } catch (err) {
        setError('Failed to fetch token');
        console.error('Fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    async function fetchRiskScore() {
      try {
        const response = await fetch('/api/risk/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokens: [{ address, chainId: chain, liquidity: token?.metrics.liquidity || 0 }]
          }),
        });
        const data = await response.json();
        const key = `${chain}-${address.toLowerCase()}`;
        if (data.success && data.results[key]) {
          setRisk(data.results[key]);
        }
      } catch (err) {
        console.error('Risk fetch error:', err);
      }
    }

    if (chain && address) {
      fetchToken();
    }
  }, [chain, address]);

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl">
        <div className="border-2 border-[#ffffff] bg-black p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-neutral-800 w-1/3"></div>
            <div className="h-64 bg-neutral-800"></div>
            <div className="h-32 bg-neutral-800"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="w-full max-w-4xl">
        <div className="border-2 border-[#ffffff] bg-black p-6">
          <button
            onClick={() => router.back()}
            className="text-neutral-500 hover:text-neutral-300 text-sm mb-4"
          >
            ← back
          </button>
          <div className="text-red-500">{error || 'Token not found'}</div>
        </div>
      </div>
    );
  }

  const chainInfo = CHAINS[chain];
  const priceChangeColor = token.metrics.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500';

  return (
    <div className="w-full max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => router.back()}
          className="text-neutral-500 hover:text-[#ffffff] text-sm transition-colors"
        >
          ← back
        </button>
        <a
          href={`${chainInfo.explorerUrl}/token/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-500 hover:text-[#ffffff] text-xs transition-colors"
        >
          view on {chainInfo.name.toLowerCase()} ↗
        </a>
      </div>

      {/* Main Container */}
      <div className="border-2 border-[#ffffff] bg-black">
        {/* Token Header */}
        <div className="p-6 border-b border-[#ffffff]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {token.logoUrl && (
                  <img
                    src={token.logoUrl}
                    alt={token.symbol}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <div>
                  <h1 className="text-xl text-[#ffffff]">{token.symbol}</h1>
                  <span className="text-sm text-neutral-500">{token.name}</span>
                </div>
                <span className="text-xs text-neutral-600 border border-neutral-700 px-2 py-0.5">
                  {chain}
                </span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-2xl text-[#ffffff] tabular-nums">
                  {formatPrice(token.metrics.price)}
                </span>
                <span className={`text-sm tabular-nums ${priceChangeColor}`}>
                  {formatPercent(token.metrics.priceChange24h)} 24h
                </span>
              </div>
            </div>
            {risk && (
              <div className="text-right">
                <div className="text-xs text-neutral-500 mb-1">risk score</div>
                <div className={`text-2xl tabular-nums ${
                  risk.level === 'low' ? 'text-green-500' :
                  risk.level === 'medium' ? 'text-yellow-500' :
                  risk.level === 'high' ? 'text-orange-500' :
                  'text-red-500'
                }`}>
                  {risk.totalScore}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chart */}
        <div className="p-6 border-b border-[#ffffff]">
          <PriceChart chainId={chain} tokenAddress={address} />
        </div>

        {/* Metrics Grid */}
        <div className="p-6 border-b border-[#ffffff]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <MetricCard label="price" value={formatPrice(token.metrics.price)} />
            <MetricCard
              label="24h change"
              value={formatPercent(token.metrics.priceChange24h)}
              className={priceChangeColor}
            />
            <MetricCard
              label="1h change"
              value={formatPercent(token.metrics.priceChange1h)}
              className={token.metrics.priceChange1h >= 0 ? 'text-green-500' : 'text-red-500'}
            />
            <MetricCard label="volume 24h" value={formatNumber(token.metrics.volume24h)} prefix="$" />
            <MetricCard label="liquidity" value={formatNumber(token.metrics.liquidity)} prefix="$" />
            <MetricCard label="market cap" value={token.metrics.marketCap ? formatNumber(token.metrics.marketCap) : '—'} prefix={token.metrics.marketCap ? '$' : ''} />
            <MetricCard label="fdv" value={token.metrics.fdv ? formatNumber(token.metrics.fdv) : '—'} prefix={token.metrics.fdv ? '$' : ''} />
            <MetricCard label="txns 24h" value={token.metrics.txns24h?.toLocaleString() || '—'} />
          </div>
        </div>

        {/* Transaction Stats */}
        {(token.metrics.buys24h !== undefined || token.metrics.sells24h !== undefined) && (
          <div className="p-6 border-b border-[#ffffff]">
            <div className="text-xs text-neutral-500 mb-3">24h transactions</div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-green-500">buys: {token.metrics.buys24h?.toLocaleString() || 0}</span>
                  <span className="text-red-500">sells: {token.metrics.sells24h?.toLocaleString() || 0}</span>
                </div>
                <div className="h-2 bg-neutral-800 flex">
                  <div
                    className="h-full bg-green-500"
                    style={{
                      width: `${((token.metrics.buys24h || 0) / ((token.metrics.buys24h || 0) + (token.metrics.sells24h || 0) || 1)) * 100}%`
                    }}
                  />
                  <div
                    className="h-full bg-red-500"
                    style={{
                      width: `${((token.metrics.sells24h || 0) / ((token.metrics.buys24h || 0) + (token.metrics.sells24h || 0) || 1)) * 100}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Whale Data */}
        <div className="p-6 border-b border-[#ffffff]">
          <div className="text-xs text-neutral-500 mb-3">whale data</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TopHoldersPanel chainId={chain} tokenAddress={address} />
            <WhaleActivityFeed chainId={chain} tokenAddress={address} />
          </div>
        </div>

        {/* Risk Analysis */}
        {risk && (
          <div className="p-6">
            <div className="text-xs text-neutral-500 mb-3">risk analysis</div>
            <RiskPanel risk={risk} className="border-0 p-0 bg-transparent" />
          </div>
        )}
      </div>

      {/* Contract Address */}
      <div className="mt-4 text-xs text-neutral-600 font-mono break-all">
        {address}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  prefix = '',
  className = ''
}: {
  label: string;
  value: string;
  prefix?: string;
  className?: string;
}) {
  return (
    <div>
      <div className="text-xs text-neutral-500 mb-1">{label}</div>
      <div className={`text-sm tabular-nums ${className || 'text-[#ffffff]'}`}>
        {prefix}{value}
      </div>
    </div>
  );
}
