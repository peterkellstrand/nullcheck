'use client';

import { useRouter } from 'next/navigation';
import { PriceChart } from './PriceChart';
import { ChartToken, ChartTimeframe } from '@/stores/chartGrid';

interface ChartGridItemProps {
  token: ChartToken;
  timeframe: ChartTimeframe;
  height: number;
  onRemove: () => void;
}

export function ChartGridItem({ token, timeframe, height, onRemove }: ChartGridItemProps) {
  const router = useRouter();

  return (
    <div className="bg-black p-4 relative group">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => router.push(`/token/${token.chainId}/${token.address}`)}
          className="text-sm text-neutral-300 hover:text-white transition-colors"
        >
          {token.symbol}
          <span className="text-neutral-600 text-xs ml-1">{token.chainId}</span>
        </button>

        {/* Remove button (visible on hover) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-500 text-sm transition-opacity"
        >
          x
        </button>
      </div>

      {/* Chart */}
      <PriceChart
        chainId={token.chainId}
        tokenAddress={token.address}
        height={height}
        showTimeframeSelector={false}
        externalTimeframe={timeframe}
        compact
      />
    </div>
  );
}
