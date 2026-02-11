'use client';

import { cn } from '@/lib/utils/format';

interface FooterProps {
  totalTokens?: number;
  lastUpdate?: Date;
  className?: string;
}

export function Footer({ totalTokens, lastUpdate, className }: FooterProps) {
  return (
    <footer
      className={cn(
        'h-8 border-t border-neutral-800 bg-neutral-950',
        'flex items-center justify-between px-6 text-xs font-mono text-neutral-600',
        className
      )}
    >
      <div className="flex items-center gap-6">
        <span>
          {totalTokens ? `${totalTokens.toLocaleString()} tokens` : 'Loading...'}
        </span>
        <span className="text-neutral-700">|</span>
        <span>ETH • BASE • SOL</span>
      </div>

      <div className="flex items-center gap-4">
        {lastUpdate && (
          <span>
            Updated: {lastUpdate.toLocaleTimeString()}
          </span>
        )}
        <span className="text-neutral-700">|</span>
        <span>No promoted tokens</span>
      </div>
    </footer>
  );
}
