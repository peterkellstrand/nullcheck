'use client';

import { cn } from '@/lib/utils/format';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-mono',
        // Sizes
        size === 'sm' && 'text-[10px] px-1.5 py-0.5',
        size === 'md' && 'text-xs px-2 py-0.5',
        // Variants
        variant === 'default' && 'bg-neutral-800 text-neutral-300 border border-neutral-700',
        variant === 'success' && 'bg-green-900/50 text-green-400 border border-green-800',
        variant === 'warning' && 'bg-yellow-900/50 text-yellow-400 border border-yellow-800',
        variant === 'danger' && 'bg-red-900/50 text-red-400 border border-red-800',
        variant === 'info' && 'bg-blue-900/50 text-blue-400 border border-blue-800',
        className
      )}
    >
      {children}
    </span>
  );
}
