'use client';

import { useState, useMemo } from 'react';
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
      if (v <= 14) return 'bg-green-500';
      if (v <= 29) return 'bg-yellow-500';
      if (v <= 49) return 'bg-orange-500';
      return 'bg-red-500';
    },
  },
};

interface TreemapRect {
  token: TokenWithMetrics;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TreemapItem {
  token: TokenWithMetrics;
  value: number;
}

// Squarified treemap algorithm - properly fills the entire space
function squarify(
  items: TreemapItem[],
  x: number,
  y: number,
  width: number,
  height: number
): TreemapRect[] {
  if (items.length === 0) return [];

  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return [];

  // Normalize values to fit the container area
  const area = width * height;
  const normalizedItems = items.map(item => ({
    ...item,
    normalizedValue: (item.value / total) * area,
  }));

  return squarifyRecursive(normalizedItems, [], x, y, width, height);
}

function squarifyRecursive(
  items: (TreemapItem & { normalizedValue: number })[],
  row: (TreemapItem & { normalizedValue: number })[],
  x: number,
  y: number,
  width: number,
  height: number
): TreemapRect[] {
  if (items.length === 0) {
    return layoutRow(row, x, y, width, height);
  }

  const item = items[0];
  const remaining = items.slice(1);
  const rowWithItem = [...row, item];

  if (row.length === 0 || improvesRatio(row, item, width, height)) {
    return squarifyRecursive(remaining, rowWithItem, x, y, width, height);
  } else {
    const rowRects = layoutRow(row, x, y, width, height);
    const rowArea = row.reduce((sum, r) => sum + r.normalizedValue, 0);

    // Calculate new bounds after laying out the row
    let newX = x, newY = y, newWidth = width, newHeight = height;
    if (width >= height) {
      const rowWidth = rowArea / height;
      newX = x + rowWidth;
      newWidth = width - rowWidth;
    } else {
      const rowHeight = rowArea / width;
      newY = y + rowHeight;
      newHeight = height - rowHeight;
    }

    return [...rowRects, ...squarifyRecursive(items, [], newX, newY, newWidth, newHeight)];
  }
}

function improvesRatio(
  row: (TreemapItem & { normalizedValue: number })[],
  item: TreemapItem & { normalizedValue: number },
  width: number,
  height: number
): boolean {
  if (row.length === 0) return true;

  const currentRatio = worstRatio(row, width, height);
  const newRatio = worstRatio([...row, item], width, height);

  return newRatio <= currentRatio;
}

function worstRatio(
  row: (TreemapItem & { normalizedValue: number })[],
  width: number,
  height: number
): number {
  if (row.length === 0) return Infinity;

  const rowArea = row.reduce((sum, r) => sum + r.normalizedValue, 0);
  const side = width >= height ? rowArea / height : rowArea / width;

  let worst = 0;
  for (const item of row) {
    const otherSide = item.normalizedValue / side;
    const ratio = Math.max(side / otherSide, otherSide / side);
    worst = Math.max(worst, ratio);
  }

  return worst;
}

function layoutRow(
  row: (TreemapItem & { normalizedValue: number })[],
  x: number,
  y: number,
  width: number,
  height: number
): TreemapRect[] {
  if (row.length === 0) return [];

  const rowArea = row.reduce((sum, r) => sum + r.normalizedValue, 0);
  const results: TreemapRect[] = [];

  if (width >= height) {
    // Lay out vertically
    const rowWidth = rowArea / height;
    let currentY = y;

    for (const item of row) {
      const itemHeight = item.normalizedValue / rowWidth;
      results.push({
        token: item.token,
        x,
        y: currentY,
        width: rowWidth,
        height: itemHeight,
      });
      currentY += itemHeight;
    }
  } else {
    // Lay out horizontally
    const rowHeight = rowArea / width;
    let currentX = x;

    for (const item of row) {
      const itemWidth = item.normalizedValue / rowHeight;
      results.push({
        token: item.token,
        x: currentX,
        y,
        width: itemWidth,
        height: rowHeight,
      });
      currentX += itemWidth;
    }
  }

  return results;
}

export function TokenHeatmap({ tokens, onTokenClick }: TokenHeatmapProps) {
  const [metric, setMetric] = useState<HeatmapMetric>('priceChange24h');
  const config = METRIC_CONFIG[metric];

  // Sort tokens by market cap descending and prepare for treemap
  // Use square root scale to prevent huge caps from dominating
  const treemapData = useMemo(() => {
    const sorted = [...tokens]
      .filter(t => (t.metrics?.marketCap || 0) > 0)
      .sort((a, b) => (b.metrics?.marketCap || 0) - (a.metrics?.marketCap || 0))
      .slice(0, 50);

    const items = sorted.map(token => ({
      token,
      value: Math.sqrt(token.metrics?.marketCap || 0),
    }));

    // Use 1600x900 base for 16:9 aspect ratio, then convert to percentages
    const rects = squarify(items, 0, 0, 1600, 900);
    return rects.map(rect => ({
      ...rect,
      x: (rect.x / 1600) * 100,
      y: (rect.y / 900) * 100,
      width: (rect.width / 1600) * 100,
      height: (rect.height / 900) * 100,
    }));
  }, [tokens]);

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

      {/* Treemap */}
      <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
        <div className="absolute inset-0 overflow-hidden">
          {treemapData.map((rect) => {
            const value = getMetricValue(rect.token);
            const colorClass = config.colorScale(value);
            const isLarge = rect.width > 8 && rect.height > 8;
            const isMedium = rect.width > 5 && rect.height > 5;

            return (
              <button
                key={`${rect.token.chainId}-${rect.token.address}`}
                onClick={() => onTokenClick?.(rect.token)}
                className={`absolute ${colorClass} flex flex-col items-center justify-center text-center transition-all hover:brightness-110 hover:z-10 border border-black/20 overflow-hidden`}
                style={{
                  left: `${rect.x}%`,
                  top: `${rect.y}%`,
                  width: `${rect.width}%`,
                  height: `${rect.height}%`,
                }}
                title={`${rect.token.symbol} - ${rect.token.name}\n${config.format(value)}`}
              >
                {isLarge ? (
                  <>
                    <span className="text-xs font-medium text-white truncate w-full px-1">
                      {rect.token.symbol}
                    </span>
                    <span className="text-[10px] text-white/80">
                      {config.format(value)}
                    </span>
                  </>
                ) : isMedium ? (
                  <span className="text-[10px] font-medium text-white truncate w-full px-0.5">
                    {rect.token.symbol}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
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
            <span>· size = market cap</span>
          </>
        )}
        {metric === 'volume24h' && (
          <span>Size = market cap</span>
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
            <span>· size = market cap</span>
          </>
        )}
      </div>
    </div>
  );
}
