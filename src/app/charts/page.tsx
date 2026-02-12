'use client';

import Link from 'next/link';
import { useChartGridStore, GridLayout, ChartTimeframe } from '@/stores/chartGrid';
import { ChartGrid } from '@/components/charts/ChartGrid';
import { ChartTokenSelector } from '@/components/charts/ChartTokenSelector';
import { cn } from '@/lib/utils/format';

const LAYOUTS: { value: GridLayout; label: string }[] = [
  { value: 'auto', label: 'auto' },
  { value: '2x2', label: '2x2' },
  { value: '3x3', label: '3x3' },
];

const TIMEFRAMES: { value: ChartTimeframe; label: string }[] = [
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
];

export default function ChartsPage() {
  const { tokens, layout, timeframe, setLayout, setTimeframe, clearTokens } = useChartGridStore();

  return (
    <div className="w-full max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4 ml-1">
          <Link
            href="/"
            className="text-neutral-500 hover:text-[#ffffff] text-sm transition-colors"
          >
            &larr; back
          </Link>
          <h1 className="text-3xl sm:text-4xl text-neutral-100">
            charts
          </h1>
        </div>

        {/* Controls */}
        {tokens.length > 0 && (
          <div className="flex items-center gap-4 mr-1">
            {/* Layout selector */}
            <div className="flex items-center gap-2">
              <span className="text-neutral-500 text-xs">layout:</span>
              <div className="flex gap-1">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => setLayout(l.value)}
                    className={cn(
                      'px-2 py-1 text-xs transition-colors',
                      layout === l.value
                        ? 'text-[#ffffff] bg-neutral-800'
                        : 'text-neutral-500 hover:text-neutral-300'
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Global timeframe */}
            <div className="flex items-center gap-2">
              <span className="text-neutral-500 text-xs">timeframe:</span>
              <div className="flex gap-1">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.value}
                    onClick={() => setTimeframe(tf.value)}
                    className={cn(
                      'px-2 py-1 text-xs transition-colors',
                      timeframe === tf.value
                        ? 'text-[#ffffff] bg-neutral-800'
                        : 'text-neutral-500 hover:text-neutral-300'
                    )}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear button */}
            <button
              onClick={clearTokens}
              className="text-neutral-500 hover:text-red-500 text-xs transition-colors"
            >
              clear all
            </button>
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="border-2 border-[#ffffff] bg-black min-h-[60vh]">
        {tokens.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-neutral-500 mb-6">no tokens selected</p>
            <ChartTokenSelector />
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-neutral-800">
              <ChartTokenSelector compact />
            </div>
            <ChartGrid />
          </>
        )}
      </div>
    </div>
  );
}
