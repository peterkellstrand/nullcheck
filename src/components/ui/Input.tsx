'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/format';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full bg-neutral-900 border border-neutral-700 text-neutral-200',
            'font-mono text-sm placeholder:text-neutral-600',
            'focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500',
            'transition-colors',
            icon ? 'pl-10 pr-4 py-2' : 'px-4 py-2',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';
