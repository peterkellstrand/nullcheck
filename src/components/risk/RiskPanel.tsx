'use client';

import Link from 'next/link';
import { RiskScore, RiskWarning } from '@/types/risk';
import { cn } from '@/lib/utils/format';
import { Badge } from '@/components/ui/Badge';

interface RiskPanelProps {
  risk: RiskScore;
  onClose?: () => void;
  className?: string;
}

export function RiskPanel({ risk, onClose, className }: RiskPanelProps) {
  return (
    <div
      className={cn(
        'bg-neutral-900 border border-neutral-700 p-6 font-mono',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="text-base text-black dark:text-neutral-400">RISK ANALYSIS</span>
          <RiskScoreBadge score={risk.totalScore} level={risk.level} />
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300 text-2xl"
          >
            ×
          </button>
        )}
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-5">
        <ScoreItem
          label="Honeypot"
          score={risk.honeypot?.score ?? 0}
          maxScore={50}
          critical={risk.honeypot?.isHoneypot ?? false}
        />
        <ScoreItem
          label="Contract"
          score={risk.contract?.score ?? 0}
          maxScore={30}
        />
        <ScoreItem
          label="Holders"
          score={risk.holders?.score ?? 0}
          maxScore={25}
        />
        <ScoreItem
          label="Liquidity"
          score={risk.liquidity?.score ?? 0}
          maxScore={25}
        />
      </div>

      {/* Key Metrics */}
      <div className="border-t border-neutral-300 dark:border-neutral-800 pt-5 mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-x-10 gap-y-4 text-base">
          <MetricRow label="Buy Tax" value={`${(risk.honeypot?.buyTax ?? 0).toFixed(1)}%`} />
          <MetricRow label="Sell Tax" value={`${(risk.honeypot?.sellTax ?? 0).toFixed(1)}%`} />
          <MetricRow label="Holders" value={(risk.holders?.totalHolders ?? 0).toLocaleString()} />
          <MetricRow label="Top 10%" value={`${(risk.holders?.top10Percent ?? 0).toFixed(1)}%`} />
          <MetricRow
            label="Verified"
            value={risk.contract?.verified ? 'Yes' : 'No'}
            highlight={!risk.contract?.verified}
          />
          <MetricRow
            label="LP Locked"
            value={`${(risk.liquidity?.lpLockedPercent ?? 0).toFixed(0)}%`}
            highlight={(risk.liquidity?.lpLockedPercent ?? 0) < 50}
          />
        </div>
      </div>

      {/* Warnings */}
      {risk.warnings.length > 0 && (
        <div className="border-t border-neutral-300 dark:border-neutral-800 pt-5">
          <div className="text-base text-black dark:text-neutral-500 mb-2">WARNINGS</div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {risk.warnings.slice(0, 3).map((warning, i) => (
              <WarningRow key={i} warning={warning} />
            ))}
            {risk.warnings.length > 3 && (
              <div className="text-base text-neutral-500">
                +{risk.warnings.length - 3} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between text-base text-black dark:text-neutral-600">
        <span>Analyzed: {new Date(risk.analyzedAt).toLocaleString()}</span>
        <Link
          href="/methodology"
          className="text-black dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
        >
          how we score &rarr;
        </Link>
      </div>
    </div>
  );
}

function RiskScoreBadge({
  score,
  level,
}: {
  score: number;
  level: RiskScore['level'];
}) {
  const variant =
    level === 'low'
      ? 'success'
      : level === 'medium'
      ? 'warning'
      : level === 'high'
      ? 'warning'
      : 'danger';

  return (
    <Badge variant={variant}>
      {score}/100
    </Badge>
  );
}

function ScoreItem({
  label,
  score,
  maxScore,
  critical = false,
}: {
  label: string;
  score: number;
  maxScore: number;
  critical?: boolean;
}) {
  const percent = (score / maxScore) * 100;

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3 text-base mb-2">
        <span className="text-black dark:text-neutral-400 truncate">{label}</span>
        <span
          className={cn(
            'shrink-0',
            critical ? 'text-red-400' : score > maxScore * 0.5 ? 'text-yellow-400' : 'text-black dark:text-neutral-300'
          )}
        >
          {score}/{maxScore}
        </span>
      </div>
      <div className="h-2 bg-neutral-300 dark:bg-neutral-800">
        <div
          className={cn(
            'h-full transition-all',
            critical
              ? 'bg-red-500'
              : percent > 70
              ? 'bg-orange-500'
              : percent > 40
              ? 'bg-yellow-500'
              : 'bg-green-500'
          )}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-black dark:text-neutral-500">{label}</span>
      <span className={highlight ? 'text-yellow-600 dark:text-yellow-400' : 'text-black dark:text-neutral-300'}>
        {value}
      </span>
    </div>
  );
}

function WarningRow({ warning }: { warning: RiskWarning }) {
  const icon =
    warning.severity === 'critical'
      ? '✗'
      : warning.severity === 'high'
      ? '⚠'
      : '•';

  const color =
    warning.severity === 'critical'
      ? 'text-red-400'
      : warning.severity === 'high'
      ? 'text-orange-400'
      : warning.severity === 'medium'
      ? 'text-yellow-400'
      : 'text-neutral-400';

  return (
    <div className={cn('text-base flex items-start gap-3', color)}>
      <span>{icon}</span>
      <span>{warning.message}</span>
    </div>
  );
}
