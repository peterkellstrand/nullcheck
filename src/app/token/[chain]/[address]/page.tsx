'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChainId, CHAINS } from '@/types/chain';
import { TokenWithMetrics } from '@/types/token';
import { RiskScore } from '@/types/risk';
import { RiskPanel } from '@/components/risk/RiskPanel';
import { RiskHistoryChart } from '@/components/risk/RiskHistoryChart';
import { Tooltip } from '@/components/ui/Tooltip';
import { PriceChart } from '@/components/charts/PriceChart';
import { CompareChart } from '@/components/charts/CompareChart';
import { LivePriceChart } from '@/components/charts/LivePriceChart';
import { TopHoldersPanel, WhaleActivityFeed } from '@/components/whale';
import { SentimentVote } from '@/components/tokens/SentimentVote';
import { AlertButton } from '@/components/alerts/AlertButton';
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

  // Fetch risk score
  const fetchRiskScore = useCallback(async (liquidity: number) => {
    try {
      const response = await fetch('/api/risk/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens: [{ address, chainId: chain, liquidity }]
        }),
      });
      const data = await response.json();
      // Solana addresses are case-sensitive, EVM addresses are lowercased
      const normalizedAddress = chain === 'solana' ? address : address.toLowerCase();
      const key = `${chain}-${normalizedAddress}`;
      if (data.success && data.data?.results?.[key]) {
        setRisk(data.data.results[key]);
      }
    } catch (err) {
      console.error('Risk fetch error:', err);
    }
  }, [chain, address]);

  // Fetch token data
  const fetchToken = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) {
        setIsLoading(true);
        setError(null);
      }

      // Fetch token data
      const response = await fetch(`/api/token/${chain}/${address}`);
      const data = await response.json();

      if (data.success && data.data?.token) {
        const tokenData = data.data.token;
        setToken(tokenData);

        // Fetch risk score (only on initial load)
        if (!isPolling) {
          if (tokenData.risk) {
            setRisk(tokenData.risk);
          } else {
            fetchRiskScore(tokenData.metrics?.liquidity || 0);
          }
        }
      } else if (!isPolling) {
        setError(data.error?.message || 'Token not found');
      }
    } catch (err) {
      if (!isPolling) {
        setError('Failed to fetch token');
      }
      console.error('Fetch error:', err);
    } finally {
      if (!isPolling) {
        setIsLoading(false);
      }
    }
  }, [chain, address, fetchRiskScore]);

  // Initial fetch
  useEffect(() => {
    if (chain && address) {
      fetchToken(false);
    }
  }, [chain, address, fetchToken]);

  // Polling for price updates every 12 seconds
  useEffect(() => {
    if (!chain || !address || isLoading) return;

    const pollInterval = setInterval(() => {
      fetchToken(true);
    }, 12000);

    return () => clearInterval(pollInterval);
  }, [chain, address, isLoading, fetchToken]);

  if (isLoading) {
    return (
      <div className="w-full max-w-6xl">
        <div className="border-2 border-[var(--border)] bg-[var(--bg-primary)] p-10">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-neutral-800 w-1/3"></div>
            <div className="h-96 bg-neutral-800"></div>
            <div className="h-52 bg-neutral-800"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="w-full max-w-6xl">
        <div className="border-2 border-[var(--border)] bg-[var(--bg-primary)] p-10">
          <button
            onClick={() => router.back()}
            className="text-neutral-500 hover:text-neutral-300 text-lg mb-6"
          >
            ← back
          </button>
          <div className="text-red-500 text-xl">{error || 'Token not found'}</div>
        </div>
      </div>
    );
  }

  const chainInfo = CHAINS[chain];

  // Defensive check: ensure chainInfo exists
  if (!chainInfo) {
    return (
      <div className="w-full max-w-6xl">
        <div className="border-2 border-[var(--border)] bg-[var(--bg-primary)] p-10">
          <button
            onClick={() => router.back()}
            className="text-neutral-500 hover:text-neutral-300 text-lg mb-6"
          >
            ← back
          </button>
          <div className="text-red-500 text-xl">Unsupported chain: {chain}</div>
        </div>
      </div>
    );
  }

  const priceChangeColor = (token.metrics?.priceChange24h ?? 0) >= 0 ? 'text-green-500' : 'text-red-500';

  return (
    <div className="w-full max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => router.back()}
          className="text-neutral-500 hover:text-[var(--text-primary)] text-lg transition-colors"
        >
          ← back
        </button>
        <a
          href={`${chainInfo.explorerUrl}/token/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-500 hover:text-[var(--text-primary)] text-base transition-colors"
        >
          view on {chainInfo.name.toLowerCase()} ↗
        </a>
      </div>

      {/* Main Container */}
      <div className="border-2 border-[var(--border)] bg-[var(--bg-primary)]">
        {/* Token Header */}
        <div className="p-6 border-b border-[var(--border)]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-5 mb-4">
                {token.logoUrl && (
                  <img
                    src={token.logoUrl}
                    alt={token.symbol}
                    className="w-12 h-12 rounded-full"
                  />
                )}
                <div>
                  <h1 className="text-3xl text-[var(--text-primary)]">{token.symbol}</h1>
                  <span className="text-lg text-neutral-500">{token.name}</span>
                </div>
                <span className="text-base text-neutral-600 border border-neutral-700 px-4 py-1.5">
                  {chain}
                </span>
              </div>
              <div className="flex items-baseline gap-5">
                <span className="text-4xl text-[var(--text-primary)] tabular-nums">
                  {formatPrice(token.metrics?.price ?? 0)}
                </span>
                <span className={`text-lg tabular-nums ${priceChangeColor}`}>
                  {formatPercent(token.metrics?.priceChange24h ?? 0)} 24h
                </span>
              </div>
            </div>
            {/* Risk Score + Sentiment */}
            <div className="text-right">
              {risk && (
                <Tooltip
                  content={
                    <div className="text-base space-y-3 w-64">
                      <div className="font-medium text-neutral-200 mb-3">Risk Score Guide</div>
                      <div className="flex items-center gap-3">
                        <span className="text-green-500 font-medium">0-14</span>
                        <span className="text-neutral-400">Low risk, generally safe</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-yellow-500 font-medium">15-29</span>
                        <span className="text-neutral-400">Medium, some concerns</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-orange-500 font-medium">30-49</span>
                        <span className="text-neutral-400">High, significant red flags</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-red-500 font-medium">50-100</span>
                        <span className="text-neutral-400">Critical, likely scam</span>
                      </div>
                    </div>
                  }
                  side="left"
                >
                  <div>
                    <div className="text-base text-neutral-500 mb-2">risk score</div>
                    <div className={`text-4xl tabular-nums ${
                      risk.level === 'low' ? 'text-green-500' :
                      risk.level === 'medium' ? 'text-yellow-500' :
                      risk.level === 'high' ? 'text-orange-500' :
                      'text-red-500'
                    }`}>
                      {risk.totalScore}
                    </div>
                  </div>
                </Tooltip>
              )}
              <div className="mt-4 flex flex-col gap-3 items-end">
                <SentimentVote chainId={chain} tokenAddress={address} />
                <AlertButton
                  chainId={chain}
                  tokenAddress={address}
                  tokenSymbol={token.symbol}
                  tokenName={token.name}
                  currentPrice={token.metrics?.price ?? 0}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Live Price */}
        <div className="p-6 border-b border-[var(--border)]">
          <LivePriceChart
            chainId={chain}
            tokenAddress={address}
            initialPrice={token.metrics?.price ?? 0}
            height={250}
          />
        </div>

        {/* Historical Chart */}
        <div className="p-6 border-b border-[var(--border)]">
          <PriceChart
            chainId={chain}
            tokenAddress={address}
            height={400}
            showVolume={true}
            showMA={true}
            showRSI={false}
            showMACD={false}
            compact={true}
          />
        </div>

        {/* Metrics Grid */}
        <div className="p-6 border-b border-[var(--border)]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <MetricCard label="price" value={formatPrice(token.metrics?.price ?? 0)} />
            <MetricCard
              label="24h change"
              value={formatPercent(token.metrics?.priceChange24h ?? 0)}
              className={priceChangeColor}
            />
            <MetricCard
              label="1h change"
              value={formatPercent(token.metrics?.priceChange1h ?? 0)}
              className={(token.metrics?.priceChange1h ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}
            />
            <MetricCard label="volume 24h" value={formatNumber(token.metrics?.volume24h ?? 0)} prefix="$" />
            <MetricCard label="liquidity" value={formatNumber(token.metrics?.liquidity ?? 0)} prefix="$" />
            <MetricCard label="market cap" value={token.metrics?.marketCap ? formatNumber(token.metrics.marketCap) : '—'} prefix={token.metrics?.marketCap ? '$' : ''} />
            <MetricCard label="fdv" value={token.metrics?.fdv ? formatNumber(token.metrics.fdv) : '—'} prefix={token.metrics?.fdv ? '$' : ''} />
            <MetricCard label="txns 24h" value={token.metrics?.txns24h?.toLocaleString() || '—'} />
          </div>
        </div>

        {/* Compare Chart */}
        <div className="p-6 border-b border-[var(--border)]">
          <CompareChart
            baseToken={{ chainId: chain, address, symbol: token.symbol }}
            height={250}
          />
        </div>

        {/* Transaction Stats */}
        {(token.metrics?.buys24h !== undefined || token.metrics?.sells24h !== undefined) && (
          <div className="p-6 border-b border-[var(--border)]">
            <div className="text-base text-neutral-500 mb-4">24h transactions</div>
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <div className="flex justify-between text-base mb-2">
                  <span className="text-green-500">buys: {token.metrics?.buys24h?.toLocaleString() || 0}</span>
                  <span className="text-red-500">sells: {token.metrics?.sells24h?.toLocaleString() || 0}</span>
                </div>
                <div className="h-3 bg-neutral-800 flex">
                  <div
                    className="h-full bg-green-500"
                    style={{
                      width: `${((token.metrics?.buys24h || 0) / ((token.metrics?.buys24h || 0) + (token.metrics?.sells24h || 0) || 1)) * 100}%`
                    }}
                  />
                  <div
                    className="h-full bg-red-500"
                    style={{
                      width: `${((token.metrics?.sells24h || 0) / ((token.metrics?.buys24h || 0) + (token.metrics?.sells24h || 0) || 1)) * 100}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Whale Data + Risk Analysis */}
        <div className="p-6 border-b border-[var(--border)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <div className="text-base text-neutral-500 mb-4">top holders</div>
              <TopHoldersPanel chainId={chain} tokenAddress={address} />
            </div>
            <div>
              <div className="text-base text-neutral-500 mb-4">whale activity</div>
              <WhaleActivityFeed chainId={chain} tokenAddress={address} />
              {risk && (
                <div className="mt-6 pt-6 border-t border-[var(--border)]">
                  <div className="text-base text-neutral-500 mb-4">risk analysis</div>
                  <RiskPanel risk={risk} className="border-0 p-0 bg-transparent" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Risk History Chart (PRO only) */}
        <div className="p-6">
          <RiskHistoryChart chainId={chain} tokenAddress={address} height={200} />
        </div>
      </div>

      {/* Contract Address */}
      <div className="mt-4 text-base text-neutral-600 font-mono break-all">
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
      <div className="text-base text-neutral-500 mb-2">{label}</div>
      <div className={`text-lg tabular-nums ${className || 'text-[var(--text-primary)]'}`}>
        {prefix}{value}
      </div>
    </div>
  );
}
