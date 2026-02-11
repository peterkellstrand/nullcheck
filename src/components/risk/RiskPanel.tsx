'use client';

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
        'bg-neutral-900 border border-neutral-700 p-4 font-mono',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-400">RISK ANALYSIS</span>
          <RiskScoreBadge score={risk.totalScore} level={risk.level} />
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300 text-lg"
          >
            ×
          </button>
        )}
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <ScoreItem
          label="Honeypot"
          score={risk.honeypot.score}
          maxScore={50}
          critical={risk.honeypot.isHoneypot}
        />
        <ScoreItem
          label="Contract"
          score={risk.contract.score}
          maxScore={30}
        />
        <ScoreItem
          label="Holders"
          score={risk.holders.score}
          maxScore={25}
        />
        <ScoreItem
          label="Liquidity"
          score={risk.liquidity.score}
          maxScore={25}
        />
      </div>

      {/* Key Metrics */}
      <div className="border-t border-neutral-800 pt-4 mb-4">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <MetricRow label="Buy Tax" value={`${risk.honeypot.buyTax.toFixed(1)}%`} />
          <MetricRow label="Sell Tax" value={`${risk.honeypot.sellTax.toFixed(1)}%`} />
          <MetricRow label="Holders" value={risk.holders.totalHolders.toLocaleString()} />
          <MetricRow label="Top 10%" value={`${risk.holders.top10Percent.toFixed(1)}%`} />
          <MetricRow
            label="Verified"
            value={risk.contract.verified ? 'Yes' : 'No'}
            highlight={!risk.contract.verified}
          />
          <MetricRow
            label="LP Locked"
            value={`${risk.liquidity.lpLockedPercent.toFixed(0)}%`}
            highlight={risk.liquidity.lpLockedPercent < 50}
          />
        </div>
      </div>

      {/* Warnings */}
      {risk.warnings.length > 0 && (
        <div className="border-t border-neutral-800 pt-4">
          <div className="text-xs text-neutral-500 mb-2">WARNINGS</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {risk.warnings.slice(0, 5).map((warning, i) => (
              <WarningRow key={i} warning={warning} />
            ))}
            {risk.warnings.length > 5 && (
              <div className="text-xs text-neutral-500">
                +{risk.warnings.length - 5} more warnings
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div className="mt-4 text-xs text-neutral-600">
        Analyzed: {new Date(risk.analyzedAt).toLocaleString()}
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
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-neutral-400">{label}</span>
        <span
          className={cn(
            critical ? 'text-red-400' : score > maxScore * 0.5 ? 'text-yellow-400' : 'text-neutral-300'
          )}
        >
          {score}/{maxScore}
        </span>
      </div>
      <div className="h-1 bg-neutral-800">
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
    <div className="flex justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className={highlight ? 'text-yellow-400' : 'text-neutral-300'}>
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
    <div className={cn('text-xs flex items-start gap-2', color)}>
      <span>{icon}</span>
      <span>{warning.message}</span>
    </div>
  );
}
