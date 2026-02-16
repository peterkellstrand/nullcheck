import { ChainId } from './chain';
import { Token, TokenMetrics, Pool, OHLCV } from './token';

// DexPaprika API Types
export interface DexPaprikaToken {
  id: string;
  address: string;
  chain: string;
  symbol: string;
  name: string;
  decimals: number;
  logo_url?: string;
  total_supply?: string;
  created_at?: string;
}

export interface DexPaprikaPool {
  id: string;
  address: string;
  chain: string;
  dex: string;
  base_token: DexPaprikaToken;
  quote_token: DexPaprikaToken;
  liquidity_usd: number;
  volume_24h_usd: number;
  created_at: string;
}

export interface DexPaprikaOHLCV {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DexPaprikaResponse<T> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// GeckoTerminal API Types
export interface GeckoTerminalToken {
  id: string;
  type: string;
  attributes: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    image_url?: string;
    coingecko_coin_id?: string;
    total_supply?: string;
  };
}

export interface GeckoTerminalPool {
  id: string;
  type: string;
  attributes: {
    address: string;
    name: string;
    pool_created_at: string;
    reserve_in_usd: string;
    base_token_price_usd: string;
    quote_token_price_usd: string;
    market_cap_usd?: string;
    fdv_usd?: string;
    volume_usd: {
      h1?: string;
      h6?: string;
      h24: string;
    };
    price_change_percentage?: {
      h1?: string;
      h6?: string;
      h24?: string;
    };
    transactions?: {
      h1?: { buys: number; sells: number };
      h24?: { buys: number; sells: number };
    };
  };
  relationships: {
    base_token: { data: { id: string } };
    quote_token: { data: { id: string } };
  };
}

export interface GeckoTerminalOHLCV {
  ohlcv_list: [number, number, number, number, number, number][];
}

// GoPlus API Types
export interface GoPlusSecurityResponse {
  code: number;
  message: string;
  result: Record<string, GoPlusTokenSecurity>;
}

export interface GoPlusTokenSecurity {
  is_honeypot?: string;
  honeypot_with_same_creator?: string;
  is_open_source?: string;
  is_proxy?: string;
  is_mintable?: string;
  can_take_back_ownership?: string;
  owner_change_balance?: string;
  hidden_owner?: string;
  selfdestruct?: string;
  external_call?: string;
  buy_tax?: string;
  sell_tax?: string;
  cannot_buy?: string;
  cannot_sell_all?: string;
  slippage_modifiable?: string;
  is_blacklisted?: string;
  is_whitelisted?: string;
  is_anti_whale?: string;
  anti_whale_modifiable?: string;
  trading_cooldown?: string;
  transfer_pausable?: string;
  holder_count?: string;
  total_supply?: string;
  holders?: GoPlusHolder[];
  lp_holders?: GoPlusLPHolder[];
  lp_total_supply?: string;
  creator_address?: string;
  creator_balance?: string;
  creator_percent?: string;
  owner_address?: string;
  owner_balance?: string;
  owner_percent?: string;
}

export interface GoPlusHolder {
  address: string;
  balance: string;
  percent: string;
  is_contract: number;
  is_locked: number;
  tag?: string;
}

export interface GoPlusLPHolder {
  address: string;
  balance: string;
  percent: string;
  is_contract: number;
  is_locked: number;
  tag?: string;
  NFT_list?: string[];
}

// TokenSniffer API Types
export interface TokenSnifferResponse {
  message: string;
  status: string;
  chainId: string;
  address: string;
  name: string;
  symbol: string;
  deployer_addr?: string;
  score: number;
  tests: TokenSnifferTest[];
  similar_contracts?: TokenSnifferSimilar[];
}

export interface TokenSnifferTest {
  id: string;
  type: string;
  result: string;
  value?: string;
  message?: string;
}

export interface TokenSnifferSimilar {
  address: string;
  name: string;
  score: number;
  is_scam: boolean;
}

// Helius API Types (Solana)
export interface HeliusAsset {
  id: string;
  content: {
    metadata: {
      name: string;
      symbol: string;
    };
    links?: {
      image?: string;
    };
  };
  token_info?: {
    supply: number;
    decimals: number;
  };
  ownership?: {
    owner: string;
  };
}

export interface HeliusHolders {
  total: number;
  limit: number;
  page: number;
  token_accounts: HeliusTokenAccount[];
}

export interface HeliusTokenAccount {
  address: string;
  owner: string;
  amount: number;
  delegated_amount: number;
}

// Alchemy API Types (EVM)
export interface AlchemyTokenMetadata {
  decimals: number;
  logo?: string;
  name: string;
  symbol: string;
}

export interface AlchemyContractMetadata {
  name?: string;
  symbol?: string;
  totalSupply?: string;
  tokenType?: string;
}

// Generic API Response
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
  timestamp?: string;
}

// SSE Event Types
export interface PriceUpdateEvent {
  type: 'price_update';
  tokenAddress: string;
  chainId: ChainId;
  price: number;
  priceChange24h: number;
  volume24h: number;
  timestamp: number;
}

export interface SSEMessage {
  event: string;
  data: PriceUpdateEvent | unknown;
}
