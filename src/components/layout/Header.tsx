'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils/format';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  return (
    <header
      className={cn(
        'h-14 border-b border-neutral-800 bg-neutral-950',
        'flex items-center justify-between px-6',
        className
      )}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2">
        <span className="font-mono text-lg text-neutral-100">
          null<span className="text-neutral-500">//</span>check
        </span>
      </Link>

      {/* Status */}
      <div className="flex items-center gap-4">
        <StatusIndicator />
        <div className="text-xs text-neutral-600 font-mono">
          v0.1.0
        </div>
      </div>
    </header>
  );
}

function StatusIndicator() {
  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </span>
      <span className="text-neutral-500">LIVE</span>
    </div>
  );
}
