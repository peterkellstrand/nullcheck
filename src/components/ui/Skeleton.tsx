'use client';

import { cn } from '@/lib/utils/format';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, width, height }: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-neutral-800 animate-pulse',
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
}

export function TokenRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-neutral-800">
      <Skeleton className="w-8 h-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-6 w-12" />
    </div>
  );
}

export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="divide-y divide-neutral-800">
      {Array.from({ length: rows }).map((_, i) => (
        <TokenRowSkeleton key={i} />
      ))}
    </div>
  );
}
