'use client';

import { Tooltip } from '@/components/ui';

interface WhaleActivityBadgeProps {
  buyCount: number;
  sellCount: number;
  className?: string;
}

export function WhaleActivityBadge({
  buyCount,
  sellCount,
  className = '',
}: WhaleActivityBadgeProps) {
  const total = buyCount + sellCount;

  if (total === 0) {
    return (
      <span className={`text-neutral-600 text-xs ${className}`}>
        —
      </span>
    );
  }

  // Determine sentiment color
  const sentiment = buyCount > sellCount ? 'bullish' : buyCount < sellCount ? 'bearish' : 'neutral';

  const colorClass =
    sentiment === 'bullish'
      ? 'text-green-400'
      : sentiment === 'bearish'
      ? 'text-red-400'
      : 'text-neutral-400';

  const bgClass =
    sentiment === 'bullish'
      ? 'bg-green-500/10'
      : sentiment === 'bearish'
      ? 'bg-red-500/10'
      : 'bg-neutral-800';

  return (
    <Tooltip
      content={
        <div className="text-xs">
          <div className="text-green-400">{buyCount} buys</div>
          <div className="text-red-400">{sellCount} sells</div>
        </div>
      }
    >
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs tabular-nums ${colorClass} ${bgClass} ${className}`}
      >
        {total}
        <span className="text-[10px]">
          {sentiment === 'bullish' ? '↑' : sentiment === 'bearish' ? '↓' : '→'}
        </span>
      </span>
    </Tooltip>
  );
}
