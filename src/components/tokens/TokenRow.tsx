'use client';

import { useState } from 'react';
import { TokenWithMetrics } from '@/types/token';
import { RiskBadge } from '@/components/risk/RiskBadge';
import { RiskPanel } from '@/components/risk/RiskPanel';
import { StarButton } from '@/components/watchlist/StarButton';
import { WhaleActivityBadge } from '@/components/whale';
import {
  formatPrice,
  formatPercent,
  formatVolume,
  formatLiquidity,
  cn,
} from '@/lib/utils/format';
import { CHAINS } from '@/types/chain';

interface TokenRowProps {
  token: TokenWithMetrics;
  rank: number;
  onTokenClick?: (token: TokenWithMetrics) => void;
  showStar?: boolean;
}

export function TokenRow({ token, rank, onTokenClick, showStar = true }: TokenRowProps) {
  const [showRiskPanel, setShowRiskPanel] = useState(false);
  const [imgError, setImgError] = useState(false);

  const priceChangeColor = (value: number) =>
    value > 0 ? 'text-green-500' : value < 0 ? 'text-red-500' : 'text-neutral-500';

  const chain = CHAINS[token.chainId];

  return (
    <>
      <tr
        className="border-b border-neutral-900 hover:bg-neutral-900/50 transition-colors cursor-pointer"
        onClick={() => onTokenClick?.(token)}
      >
        <td className="py-3 px-4">
          <div className="flex items-center">
            {/* Star */}
            {showStar && (
              <div className="w-6 flex-shrink-0">
                <StarButton chainId={token.chainId} address={token.address} />
              </div>
            )}

            {/* Rank */}
            <div className="w-6 flex-shrink-0 text-neutral-600 text-xs">
              {rank}
            </div>

            {/* Token Info */}
            <div className="flex-[2] min-w-0 flex items-center gap-2">
              {/* Logo */}
              <div className="w-6 h-6 bg-neutral-900 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                {token.logoUrl && !imgError ? (
                  <img
                    src={token.logoUrl}
                    alt={token.symbol}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                    loading="lazy"
                  />
                ) : (
                  <span className="text-[9px] text-neutral-600">
                    {token.symbol.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Symbol & Chain */}
              <div className="min-w-0 flex items-center gap-1.5">
                <span className="text-[var(--text-primary)] text-sm truncate">
                  {token.symbol}
                </span>
                <span className="text-[9px] text-[var(--text-muted)] flex-shrink-0">
                  {chain.symbol.toLowerCase()}
                </span>
              </div>
            </div>

            {/* Hot/Trending Score */}
            <div className="flex-1 text-right">
              <span
                className={cn(
                  'tabular-nums text-xs',
                  (token.metrics.trendingScore ?? 0) >= 80
                    ? 'text-green-400'
                    : (token.metrics.trendingScore ?? 0) >= 60
                    ? 'text-yellow-400'
                    : 'text-neutral-500'
                )}
              >
                {token.metrics.trendingScore ?? '-'}
              </span>
            </div>

            {/* Price */}
            <div className="flex-1 text-right">
              <span className="text-[var(--text-primary)] tabular-nums text-xs">
                {formatPrice(token.metrics.price)}
              </span>
            </div>

            {/* 1h Change */}
            <div className="flex-1 text-right hidden sm:block">
              <span className={cn('tabular-nums text-xs', priceChangeColor(token.metrics.priceChange1h))}>
                {formatPercent(token.metrics.priceChange1h)}
              </span>
            </div>

            {/* 24h Change */}
            <div className="flex-1 text-right">
              <span className={cn('tabular-nums text-xs', priceChangeColor(token.metrics.priceChange24h))}>
                {formatPercent(token.metrics.priceChange24h)}
              </span>
            </div>

            {/* 7d Change */}
            <div className="flex-1 text-right hidden sm:block">
              {token.metrics.priceChange7d !== 0 ? (
                <span className={cn('tabular-nums text-xs', priceChangeColor(token.metrics.priceChange7d))}>
                  {formatPercent(token.metrics.priceChange7d)}
                </span>
              ) : (
                <span className="text-neutral-700 text-xs">-</span>
              )}
            </div>

            {/* Volume */}
            <div className="flex-1 text-right hidden sm:block">
              <span className="text-[var(--text-secondary)] tabular-nums text-xs">
                {formatVolume(token.metrics.volume24h)}
              </span>
            </div>

            {/* Liquidity */}
            <div className="flex-1 text-right">
              <span className="text-[var(--text-secondary)] tabular-nums text-xs">
                {formatLiquidity(token.metrics.liquidity)}
              </span>
            </div>

            {/* Whale Activity */}
            <div className="flex-1 text-right hidden sm:block">
              <WhaleActivityBadge
                buyCount={Math.floor((token.metrics.buys24h || 0) * 0.1)}
                sellCount={Math.floor((token.metrics.sells24h || 0) * 0.1)}
              />
            </div>

            {/* Risk */}
            <div className="flex-1 text-right">
              <RiskBadge
                risk={token.risk}
                onClick={(e) => {
                  e?.stopPropagation?.();
                  setShowRiskPanel(!showRiskPanel);
                }}
              />
            </div>
          </div>
        </td>
      </tr>

      {/* Expandable Risk Panel */}
      {showRiskPanel && token.risk && (
        <tr>
          <td className="p-0">
            <RiskPanel
              risk={token.risk}
              onClose={() => setShowRiskPanel(false)}
              className="border-t-0"
            />
          </td>
        </tr>
      )}
    </>
  );
}
