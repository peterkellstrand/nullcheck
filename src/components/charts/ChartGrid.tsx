'use client';

import { useChartGridStore, GridLayout } from '@/stores/chartGrid';
import { ChartGridItem } from './ChartGridItem';
import { cn } from '@/lib/utils/format';

const GRID_CLASSES: Record<GridLayout, string> = {
  '2x2': 'grid-cols-2',
  '3x3': 'grid-cols-3',
  'auto': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
};

export function ChartGrid() {
  const { tokens, layout, timeframe, removeToken } = useChartGridStore();

  // Calculate appropriate height based on layout and token count
  const getChartHeight = () => {
    const count = tokens.length;
    if (layout === '3x3' || count > 4) return 200;
    if (layout === '2x2' || count > 2) return 280;
    return 350;
  };

  return (
    <div
      className={cn(
        'grid gap-px bg-neutral-800',
        GRID_CLASSES[layout]
      )}
    >
      {tokens.map((token) => (
        <ChartGridItem
          key={`${token.chainId}-${token.address}`}
          token={token}
          timeframe={timeframe}
          height={getChartHeight()}
          onRemove={() => removeToken(token.chainId, token.address)}
        />
      ))}
    </div>
  );
}
