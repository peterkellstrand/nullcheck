/**
 * Type definitions for the nullcheck API.
 *
 * All types are fully documented with thresholds and interpretation guidance
 * so AI agents and developers can make informed decisions.
 */

/** Supported blockchain networks */
export type ChainId = 'ethereum' | 'base' | 'solana';

/** Risk severity levels */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** Standard API response wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  cached?: boolean;
}

/** Token identity */
export interface Token {
  address: string;
  chainId: ChainId;
  symbol: string;
  name: string;
  decimals?: number;
  logoUrl?: string | null;
}

/** Market metrics for a token */
export interface TokenMetrics {
  /** Current price in USD */
  price: number;
  /** Price change over 1 hour (percentage) */
  priceChange1h: number;
  /** Price change over 24 hours (percentage) */
  priceChange24h: number;
  /** 24-hour trading volume in USD */
  volume24h: number;
  /** Total DEX liquidity in USD. Below $10K = untradeable. Below $50K = thin. Above $100K = healthy. */
  liquidity: number;
  /** Market cap in USD, null if unknown */
  marketCap: number | null;
  /** Total transactions in 24 hours */
  txns24h: number;
  /** Buy transactions in 24 hours */
  buys24h: number;
  /** Sell transactions in 24 hours */
  sells24h: number;
}

/** Token with market metrics and optional risk score */
export interface TokenWithMetrics extends Token {
  metrics?: TokenMetrics;
  risk?: RiskScore;
}

/**
 * Comprehensive risk assessment.
 *
 * Score ranges: LOW (0-14), MEDIUM (15-29), HIGH (30-49), CRITICAL (50-100).
 * If level == "critical" or honeypot.isHoneypot == true, do NOT trade.
 */
export interface RiskScore {
  /** Composite score 0-100. Higher = more dangerous. */
  totalScore: number;
  /** Human-readable risk level */
  level: RiskLevel;
  /** Liquidity pool health (0-5 points) */
  liquidity?: LiquidityRisk;
  /** Holder distribution analysis (0-15 points) */
  holders?: HolderRisk;
  /** Smart contract security (0-30 points) */
  contract?: ContractRisk;
  /** Honeypot detection (0-50 points, HIGHEST weight) */
  honeypot?: HoneypotRisk;
  /** Specific risk findings with severity */
  warnings?: RiskWarning[];
  /** When this analysis was performed */
  analyzedAt?: string;
}

/** Liquidity pool health. Unlocked LP or low liquidity are warning signs. */
export interface LiquidityRisk {
  /** Sub-score (0-5) */
  score: number;
  /** Total liquidity in USD */
  liquidity: number;
  /** Whether LP tokens are locked in a timelock contract */
  lpLocked: boolean;
  /** Percentage of LP tokens locked (0-100) */
  lpLockedPercent: number;
}

/** Token distribution analysis. High concentration = rug pull risk. */
export interface HolderRisk {
  /** Sub-score (0-15) */
  score: number;
  /** Total unique holder addresses */
  totalHolders: number;
  /** Percentage of supply held by top 10 wallets. Above 50% = high risk. */
  top10Percent: number;
  /** Percentage held by token creator. Above 10% = dump risk. */
  creatorHoldingPercent: number;
}

/** Smart contract security analysis. */
export interface ContractRisk {
  /** Sub-score (0-30) */
  score: number;
  /** Whether source code is verified on block explorer */
  verified: boolean;
  /** Whether ownership has been renounced */
  renounced: boolean;
  /** Whether the contract can mint new tokens (dilution risk) */
  hasMintFunction: boolean;
  /** Maximum buy/sell tax the contract allows */
  maxTaxPercent: number;
}

/**
 * Honeypot detection — the most critical risk check.
 * If isHoneypot is true, you CANNOT sell the token. Do not buy.
 */
export interface HoneypotRisk {
  /** Sub-score (0-50, highest weight in total score) */
  score: number;
  /** TRUE = you cannot sell this token. NEVER buy a honeypot. */
  isHoneypot: boolean;
  /** Tax percentage on purchase (0-100). Normal: 0-2%. */
  buyTax: number;
  /** Tax percentage on sale (0-100). Above 10% is suspicious. Above 25% is effectively a honeypot. */
  sellTax: number;
  /** Whether selling is completely blocked at the contract level */
  cannotSell: boolean;
}

/** Individual risk finding */
export interface RiskWarning {
  /** Machine-readable code (e.g., "high_holder_concentration") */
  code: string;
  /** Severity level */
  severity: string;
  /** Human-readable explanation */
  message: string;
}

/** Whale transaction record */
export interface WhaleTransaction {
  txHash: string;
  type: 'buy' | 'sell';
  tokenAddress: string;
  chainId: string;
  walletAddress: string;
  amount: number;
  valueUsd: number;
  timestamp: number;
  priceAtTx?: number;
}

/**
 * 24-hour whale activity summary.
 * Positive netFlow24h = accumulation (bullish). Negative = distribution (bearish).
 */
export interface WhaleActivity {
  count24h: number;
  buyCount24h: number;
  sellCount24h: number;
  /** Buy count minus sell count. Positive = bullish signal. */
  netFlow24h: number;
  largestTx?: WhaleTransaction;
  recentTransactions?: WhaleTransaction[];
}

/** Top token holder with metadata */
export interface TokenHolder {
  address: string;
  balance: string;
  /** Percentage of total supply */
  percent: number;
  /** Whether this is a contract address (DEX, vault, etc.) */
  isContract: boolean;
  /** Whether tokens are locked (vesting, LP lock) */
  isLocked: boolean;
  /** Label if known: DEX, Burn, Team, LP, Bridge, etc. */
  tag?: string;
}

/** Batch risk analysis result */
export interface BatchRiskResult {
  /** Map of "chain-address" to risk score */
  results: Record<string, RiskScore>;
  /** Map of "chain-address" to error message for failed tokens */
  errors?: Record<string, string>;
  meta: {
    requested: number;
    analyzed?: number;
    succeeded?: number;
    failed?: number;
    cached?: number;
  };
}

/** Options for creating the nullcheck client */
export interface NullcheckOptions {
  /** API key (format: nk_ followed by 32 characters). Get one at nullcheck.io/pricing */
  apiKey: string;
  /** Override base URL (default: https://api.nullcheck.io) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}
