import { TokenWithMetrics } from '@/types/token';

export interface TrendingConfig {
  weights: {
    volumeMomentum: number;
    priceAction: number;
    buyPressure: number;
    activityLevel: number;
    ageBonus: number;
  };
  penalties: {
    enableRiskPenalty: boolean;
    enableNewTokenPenalty: boolean;
  };
}

export const DEFAULT_TRENDING_CONFIG: TrendingConfig = {
  weights: {
    volumeMomentum: 0.30,
    priceAction: 0.25,
    buyPressure: 0.20,
    activityLevel: 0.15,
    ageBonus: 0.10,
  },
  penalties: {
    enableRiskPenalty: true,
    enableNewTokenPenalty: true,
  },
};

/**
 * Calculate volume momentum score (0-100)
 * Volume-to-liquidity ratio indicates active trading
 * Capped to avoid wash trading signals
 */
function calculateVolumeMomentum(volume24h: number, liquidity: number): number {
  if (liquidity <= 0) return 0;
  const vlRatio = volume24h / liquidity;
  // Cap at 5x volume-to-liquidity (anything higher is suspicious)
  const cappedVL = Math.min(vlRatio, 5);
  return (cappedVL / 5) * 100;
}

/**
 * Calculate price action score (0-100)
 * Weighted combination of timeframes (recent matters more)
 * Normalized so +50% = 100, -50% = 0, 0% = 50
 */
function calculatePriceAction(
  priceChange1h: number,
  priceChange24h: number,
  priceChange7d: number
): number {
  // Weight recent changes more heavily
  const weightedChange =
    priceChange1h * 0.5 +
    priceChange24h * 0.35 +
    priceChange7d * 0.15;

  // Normalize: -50% to +50% maps to 0-100
  // Clamp to reasonable bounds
  const normalized = Math.min(100, Math.max(0, (weightedChange + 50)));
  return normalized;
}

/**
 * Calculate buy pressure score (0-100)
 * Higher ratio of buys to sells = higher score
 */
function calculateBuyPressure(buys24h?: number, sells24h?: number): number {
  const buys = buys24h ?? 0;
  const sells = sells24h ?? 0;
  const total = buys + sells;

  if (total === 0) return 50; // Neutral if no data

  const buyRatio = buys / total;
  return buyRatio * 100;
}

/**
 * Calculate activity level score (0-100)
 * Log scale for transaction count (diminishing returns)
 */
function calculateActivityLevel(txns24h?: number): number {
  const txns = txns24h ?? 0;
  if (txns === 0) return 0;

  // Log10 scale: 10 txns = 25, 100 txns = 50, 1000 txns = 75, 10000 txns = 100
  const logTxns = Math.log10(txns + 1);
  // Normalize: assume 10000 txns (log10 = 4) is max normal activity
  return Math.min(100, (logTxns / 4) * 100);
}

/**
 * Calculate age bonus score (0-100)
 * Newer tokens get penalty (pump-dump risk)
 * Established tokens get full bonus
 */
function calculateAgeBonus(createdAt?: string): number {
  if (!createdAt) return 50; // Neutral if no data

  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  // < 6 hours: high pump-dump risk
  if (ageHours < 6) return 20;
  // 6-24 hours: still risky
  if (ageHours < 24) return 40;
  // 1-7 days: moderate confidence
  if (ageHours < 168) return 60 + (ageHours / 168) * 40;
  // > 7 days: established
  return 100;
}

/**
 * Apply risk penalty to trending score
 * High risk tokens get penalized
 */
function applyRiskPenalty(score: number, riskScore?: number): number {
  if (riskScore === undefined) return score;

  if (riskScore >= 70) return score * 0.5; // Critical: 50% penalty
  if (riskScore >= 50) return score * 0.7; // High: 30% penalty
  if (riskScore >= 30) return score * 0.9; // Medium: 10% penalty
  return score; // Low risk: no penalty
}

/**
 * Apply new token penalty
 * Very new tokens get additional penalty
 */
function applyNewTokenPenalty(score: number, createdAt?: string): number {
  if (!createdAt) return score;

  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours < 1) return score * 0.3; // < 1 hour: 70% penalty
  if (ageHours < 6) return score * 0.6; // < 6 hours: 40% penalty
  if (ageHours < 24) return score * 0.8; // < 24 hours: 20% penalty
  return score;
}

/**
 * Calculate composite trending score for a single token
 */
export function calculateTrendingScore(
  token: TokenWithMetrics,
  config: TrendingConfig = DEFAULT_TRENDING_CONFIG
): number {
  const { metrics, createdAt, risk } = token;
  const { weights, penalties } = config;

  // Calculate component scores
  const volumeScore = calculateVolumeMomentum(metrics.volume24h, metrics.liquidity);
  const priceScore = calculatePriceAction(
    metrics.priceChange1h,
    metrics.priceChange24h,
    metrics.priceChange7d
  );
  const buyPressureScore = calculateBuyPressure(metrics.buys24h, metrics.sells24h);
  const activityScore = calculateActivityLevel(metrics.txns24h);
  const ageScore = calculateAgeBonus(createdAt);

  // Weighted composite
  let trendingScore =
    volumeScore * weights.volumeMomentum +
    priceScore * weights.priceAction +
    buyPressureScore * weights.buyPressure +
    activityScore * weights.activityLevel +
    ageScore * weights.ageBonus;

  // Apply penalties
  if (penalties.enableRiskPenalty) {
    trendingScore = applyRiskPenalty(trendingScore, risk?.totalScore);
  }
  if (penalties.enableNewTokenPenalty) {
    trendingScore = applyNewTokenPenalty(trendingScore, createdAt);
  }

  // Clamp to 0-100 and round
  return Math.round(Math.min(100, Math.max(0, trendingScore)));
}

/**
 * Calculate trending scores for an array of tokens
 */
export function calculateTrendingScores(
  tokens: TokenWithMetrics[],
  config?: TrendingConfig
): TokenWithMetrics[] {
  return tokens.map((token) => ({
    ...token,
    metrics: {
      ...token.metrics,
      trendingScore: calculateTrendingScore(token, config),
    },
  }));
}
