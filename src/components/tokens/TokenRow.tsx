'use client';

import { useState } from 'react';
import { TokenWithMetrics } from '@/types/token';
import { RiskBadge } from '@/components/risk/RiskBadge';
import { RiskPanel } from '@/components/risk/RiskPanel';
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
}

export function TokenRow({ token, rank, onTokenClick }: TokenRowProps) {
  const [showRiskPanel, setShowRiskPanel] = useState(false);
  const [imgError, setImgError] = useState(false);

  const priceChangeColor = (value: number) =>
    value > 0 ? 'text-green-500' : value < 0 ? 'text-red-500' : 'text-neutral-500';

  const chain = CHAINS[token.chainId];

  return (
    <>
      <tr
        className="border-b border-neutral-800 hover:bg-neutral-900/30 transition-colors cursor-pointer"
        onClick={() => onTokenClick?.(token)}
      >
        {/* Rank */}
        <td className="px-4 py-3 text-neutral-600 text-xs w-8">
          {rank}
        </td>

        {/* Token Info */}
        <td className="px-2 py-3">
          <div className="flex items-center gap-2">
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
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-200 text-sm">
                  {token.symbol}
                </span>
                <span className="text-[9px] text-neutral-700">
                  {chain.symbol.toLowerCase()}
                </span>
              </div>
            </div>
          </div>
        </td>

        {/* Price */}
        <td className="px-2 py-3 text-right">
          <span className="text-neutral-300 tabular-nums text-sm">
            {formatPrice(token.metrics.price)}
          </span>
        </td>

        {/* 1h Change */}
        <td className="px-2 py-3 text-right hidden sm:table-cell">
          <span className={cn('tabular-nums text-sm', priceChangeColor(token.metrics.priceChange1h))}>
            {formatPercent(token.metrics.priceChange1h)}
          </span>
        </td>

        {/* 24h Change */}
        <td className="px-2 py-3 text-right">
          <span className={cn('tabular-nums text-sm', priceChangeColor(token.metrics.priceChange24h))}>
            {formatPercent(token.metrics.priceChange24h)}
          </span>
        </td>

        {/* 7d Change */}
        <td className="px-2 py-3 text-right hidden sm:table-cell">
          {token.metrics.priceChange7d !== 0 ? (
            <span className={cn('tabular-nums text-sm', priceChangeColor(token.metrics.priceChange7d))}>
              {formatPercent(token.metrics.priceChange7d)}
            </span>
          ) : (
            <span className="text-neutral-700 text-sm">-</span>
          )}
        </td>

        {/* Volume */}
        <td className="px-2 py-3 text-right hidden sm:table-cell">
          <span className="text-neutral-400 tabular-nums text-sm">
            {formatVolume(token.metrics.volume24h)}
          </span>
        </td>

        {/* Liquidity */}
        <td className="px-2 py-3 text-right">
          <span className="text-neutral-400 tabular-nums text-sm">
            {formatLiquidity(token.metrics.liquidity)}
          </span>
        </td>

        {/* Risk */}
        <td className="px-2 py-3 text-right">
          <RiskBadge
            risk={token.risk}
            onClick={(e) => {
              e?.stopPropagation?.();
              setShowRiskPanel(!showRiskPanel);
            }}
          />
        </td>
      </tr>

      {/* Expandable Risk Panel */}
      {showRiskPanel && token.risk && (
        <tr>
          <td colSpan={9} className="p-0">
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
