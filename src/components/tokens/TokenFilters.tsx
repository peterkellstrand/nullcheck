'use client';

import { ChainId, CHAINS } from '@/types/chain';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/format';

interface TokenFiltersProps {
  selectedChain?: ChainId;
  onChainChange: (chain?: ChainId) => void;
  minLiquidity?: number;
  onMinLiquidityChange: (value?: number) => void;
  className?: string;
}

const LIQUIDITY_OPTIONS = [
  { label: 'All', value: undefined, showOnMobile: true },
  { label: '>$10K', value: 10000, showOnMobile: true },
  { label: '>$50K', value: 50000, showOnMobile: false },
  { label: '>$100K', value: 100000, showOnMobile: true },
  { label: '>$500K', value: 500000, showOnMobile: false },
];

export function TokenFilters({
  selectedChain,
  onChainChange,
  minLiquidity,
  onMinLiquidityChange,
  className,
}: TokenFiltersProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 sm:gap-4', className)}>
      {/* Chain Filter */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] sm:text-xs text-neutral-500 uppercase">Chain:</span>
        <div className="flex gap-1">
          <Button
            variant={!selectedChain ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onChainChange(undefined)}
          >
            All
          </Button>
          {Object.values(CHAINS).map((chain) => (
            <Button
              key={chain.id}
              variant={selectedChain === chain.id ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => onChainChange(chain.id)}
            >
              {chain.symbol}
            </Button>
          ))}
        </div>
      </div>

      {/* Liquidity Filter */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] sm:text-xs text-neutral-500 uppercase">Liq:</span>
        <div className="flex gap-1">
          {LIQUIDITY_OPTIONS.map((opt) => (
            <Button
              key={opt.label}
              variant={minLiquidity === opt.value ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => onMinLiquidityChange(opt.value)}
              className={cn(!opt.showOnMobile && 'hidden sm:inline-flex')}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
