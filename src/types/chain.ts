export type ChainId = 'ethereum' | 'base' | 'solana' | 'arbitrum' | 'polygon';

export interface Chain {
  id: ChainId;
  name: string;
  symbol: string;
  rpcUrl: string;
  explorerUrl: string;
  iconUrl?: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  isEvm: boolean;
}

export const CHAINS: Record<ChainId, Chain> = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    rpcUrl: 'https://eth.drpc.org',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    isEvm: true,
  },
  base: {
    id: 'base',
    name: 'Base',
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    isEvm: true,
  },
  solana: {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://solscan.io',
    nativeCurrency: {
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9,
    },
    isEvm: false,
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum',
    symbol: 'ETH',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    isEvm: true,
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    symbol: 'MATIC',
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
    isEvm: true,
  },
};
