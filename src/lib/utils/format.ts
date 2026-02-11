export function formatNumber(
  value: number,
  options?: {
    decimals?: number;
    compact?: boolean;
    prefix?: string;
    suffix?: string;
  }
): string {
  const { decimals = 2, compact = false, prefix = '', suffix = '' } = options || {};

  if (value === 0) return `${prefix}0${suffix}`;

  if (compact) {
    const absValue = Math.abs(value);
    if (absValue >= 1e9) {
      return `${prefix}${(value / 1e9).toFixed(decimals)}B${suffix}`;
    }
    if (absValue >= 1e6) {
      return `${prefix}${(value / 1e6).toFixed(decimals)}M${suffix}`;
    }
    if (absValue >= 1e3) {
      return `${prefix}${(value / 1e3).toFixed(decimals)}K${suffix}`;
    }
  }

  return `${prefix}${value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`;
}

export function formatPrice(value: number): string {
  if (value === 0) return '$0.00';

  const absValue = Math.abs(value);

  // Very small prices
  if (absValue < 0.000001) {
    return `$${value.toExponential(2)}`;
  }

  // Small prices - show more decimals
  if (absValue < 0.01) {
    return `$${value.toFixed(6)}`;
  }

  if (absValue < 1) {
    return `$${value.toFixed(4)}`;
  }

  if (absValue < 1000) {
    return `$${value.toFixed(2)}`;
  }

  return formatNumber(value, { prefix: '$', compact: true, decimals: 2 });
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatVolume(value: number): string {
  return formatNumber(value, { prefix: '$', compact: true, decimals: 1 });
}

export function formatLiquidity(value: number): string {
  return formatNumber(value, { prefix: '$', compact: true, decimals: 1 });
}

export function formatAddress(address: string, chars: number = 4): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return past.toLocaleDateString();
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
