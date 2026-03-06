'use client';

import { RiskLevel, RiskScore } from '@/types/risk';
import { cn } from '@/lib/utils/format';

interface RiskBadgeProps {
  risk?: RiskScore;
  level?: RiskLevel;
  score?: number;
  onClick?: (e?: React.MouseEvent) => void;
  className?: string;
}

// Static config — moved outside component to avoid re-creation on every render
const RISK_CONFIG: Record<RiskLevel, { label: string; color: string }> = {
  low: { label: 'low', color: 'text-green-600' },
  medium: { label: 'med', color: 'text-yellow-600' },
  high: { label: 'high', color: 'text-orange-500' },
  critical: { label: 'crit', color: 'text-red-500' },
};

export function RiskBadge({
  risk,
  level: levelProp,
  score: scoreProp,
  onClick,
  className,
}: RiskBadgeProps) {
  const level = risk?.level ?? levelProp ?? 'medium';
  const score = risk?.totalScore ?? scoreProp;

  const { label, color } = RISK_CONFIG[level];

  // Show "..." if no risk data yet
  if (score === undefined) {
    return (
      <span className={cn('text-sm text-neutral-700', className)}>
        ...
      </span>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'text-sm tabular-nums',
        onClick && 'hover:underline cursor-pointer',
        !onClick && 'cursor-default',
        color,
        className
      )}
    >
      {score}
    </button>
  );
}
