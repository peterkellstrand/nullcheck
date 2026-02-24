'use client';

import { useState } from 'react';
import { TokenWithMetrics } from '@/types/token';

interface TokenHeatmapProps {
  tokens: TokenWithMetrics[];
  onTokenClick?: (token: TokenWithMetrics) => void;
}

type HeatmapMetric = 'priceChange24h' | 'volume24h' | 'riskScore';

const METRIC_CONFIG: Record<HeatmapMetric, { label: string; format: (v: number) => string; colorScale: (v: number) => string }> = {
  priceChange24h: {
    label: '24h %',
    format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
    colorScale: (v) => {
      // Green for positive, red for negative
      if (v >= 20) return 'bg-green-600';
      if (v >= 10) return 'bg-green-500';
      if (v >= 5) return 'bg-green-500/70';
      if (v >= 0) return 'bg-green-500/40';
      if (v >= -5) return 'bg-red-500/40';
      if (v >= -10) return 'bg-red-500/70';
      if (v >= -20) return 'bg-red-500';
      return 'bg-red-600';
    },
  },
  volume24h: {
    label: 'Volume',
    format: (v) => {
      if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
      if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
      if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
      return `$${v.toFixed(0)}`;
    },
    colorScale: (v) => {
      // Intensity based on volume (relative scale)
      if (v >= 10e6) return 'bg-blue-600';
      if (v >= 5e6) return 'bg-blue-500';
      if (v >= 1e6) return 'bg-blue-500/70';
      if (v >= 500e3) return 'bg-blue-500/50';
      if (v >= 100e3) return 'bg-blue-500/30';
      return 'bg-blue-500/20';
    },
  },
  riskScore: {
    label: 'Risk',
    format: (v) => `${v}`,
    colorScale: (v) => {
      // Green for low risk, red for high risk
      if (v <= 14) return 'bg-green-500';
      if (v <= 29) return 'bg-yellow-500';
      if (v <= 49) return 'bg-orange-500';
      return 'bg-red-500';
    },
  },
};

export function TokenHeatmap({ tokens, onTokenClick }: TokenHeatmapProps) {
  const [metric, setMetric] = useState<HeatmapMetric>('priceChange24h');
  const config = METRIC_CONFIG[metric];

  // Sort tokens by volume for better visual hierarchy
  const sortedTokens = [...tokens].sort((a, b) =>
    (b.metrics?.volume24h || 0) - (a.metrics?.volume24h || 0)
  );

  // Calculate cell sizes based on volume (larger volume = larger cell)
  const maxVolume = Math.max(...tokens.map(t => t.metrics?.volume24h || 0), 1);

  const getMetricValue = (token: TokenWithMetrics): number => {
    switch (metric) {
      case 'priceChange24h':
        return token.metrics?.priceChange24h || 0;
      case 'volume24h':
        return token.metrics?.volume24h || 0;
      case 'riskScore':
        return token.risk?.totalScore || 0;
    }
  };

  const getCellSize = (token: TokenWithMetrics): string => {
    const volume = token.metrics?.volume24h || 0;
    const ratio = volume / maxVolume;
    if (ratio > 0.5) return 'col-span-2 row-span-2';
    if (ratio > 0.2) return 'col-span-2';
    return '';
  };

  return (
    <div>
      {/* Metric Selector */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-neutral-500">heatmap view</span>
        <div className="flex gap-1 border border-neutral-700">
          {(Object.keys(METRIC_CONFIG) as HeatmapMetric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1 text-xs transition-colors ${
                metric === m
                  ? 'text-[#ffffff] bg-neutral-800'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {METRIC_CONFIG[m].label}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1">
        {sortedTokens.slice(0, 50).map((token) => {
          const value = getMetricValue(token);
          const colorClass = config.colorScale(value);
          const sizeClass = getCellSize(token);

          return (
            <button
              key={`${token.chainId}-${token.address}`}
              onClick={() => onTokenClick?.(token)}
              className={`${sizeClass} ${colorClass} p-2 min-h-[60px] flex flex-col items-center justify-center text-center transition-all hover:brightness-110 hover:scale-105 border border-black/20`}
              title={`${token.symbol} - ${token.name}\n${config.format(value)}`}
            >
              <span className="text-xs font-medium text-white truncate w-full">
                {token.symbol}
              </span>
              <span className="text-[10px] text-white/80">
                {config.format(value)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-neutral-500">
        {metric === 'priceChange24h' && (
          <>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-red-500"></span> negative
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-green-500"></span> positive
            </span>
          </>
        )}
        {metric === 'volume24h' && (
          <span>Larger cells = higher volume</span>
        )}
        {metric === 'riskScore' && (
          <>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-green-500"></span> low
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-yellow-500"></span> medium
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-orange-500"></span> high
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-red-500"></span> critical
            </span>
          </>
        )}
      </div>
    </div>
  );
}
