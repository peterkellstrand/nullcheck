import { ChainId } from './chain';
import { RiskScore } from './risk';

export interface Token {
  address: string;
  chainId: ChainId;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
  totalSupply?: string;
  createdAt?: string;
}

export interface TokenMetrics {
  tokenAddress: string;
  chainId: ChainId;
  price: number;
  priceChange1h: number;
  priceChange24h: number;
  priceChange7d: number;
  volume24h: number;
  liquidity: number;
  marketCap?: number;
  fdv?: number;
  holders?: number;
  txns24h?: number;
  buys24h?: number;
  sells24h?: number;
  trendingScore?: number;
  updatedAt: string;
}

export interface Pool {
  address: string;
  chainId: ChainId;
  dex: string;
  baseToken: Token;
  quoteToken: Token;
  liquidity: number;
  volume24h: number;
  createdAt: string;
  lpLocked?: boolean;
  lpLockedPercent?: number;
}

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TokenWithMetrics extends Token {
  metrics: TokenMetrics;
  risk?: RiskScore;
  pools?: Pool[];
}

export interface TokenSearchResult {
  address: string;
  chainId: ChainId;
  symbol: string;
  name: string;
  logoUrl?: string;
  liquidity?: number;
  volume24h?: number;
}

export type SortField =
  | 'trending'
  | 'price'
  | 'priceChange1h'
  | 'priceChange24h'
  | 'priceChange7d'
  | 'volume24h'
  | 'liquidity'
  | 'marketCap'
  | 'holders'
  | 'txns24h'
  | 'risk'
  | 'whales';

export type SortDirection = 'asc' | 'desc';

export interface TokenFilters {
  chain?: ChainId;
  minLiquidity?: number;
  maxLiquidity?: number;
  minVolume?: number;
  maxRiskScore?: number;
  verified?: boolean;
}
