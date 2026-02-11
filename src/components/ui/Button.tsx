'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/format';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-mono transition-colors',
          'focus:outline-none focus:ring-1 focus:ring-neutral-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // Variants
          variant === 'primary' &&
            'bg-neutral-800 text-neutral-100 hover:bg-neutral-700 border border-neutral-600',
          variant === 'secondary' &&
            'bg-neutral-900 text-neutral-300 hover:bg-neutral-800 border border-neutral-700',
          variant === 'ghost' &&
            'bg-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800',
          variant === 'danger' &&
            'bg-red-900/50 text-red-400 hover:bg-red-900/70 border border-red-800',
          // Sizes
          size === 'sm' && 'text-xs px-2 py-1',
          size === 'md' && 'text-sm px-3 py-1.5',
          size === 'lg' && 'text-base px-4 py-2',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
