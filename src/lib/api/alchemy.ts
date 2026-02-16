import { ChainId } from '@/types/chain';
import { AlchemyTokenMetadata, AlchemyContractMetadata } from '@/types/api';
import { Token } from '@/types/token';

const NETWORK_MAP: Record<Exclude<ChainId, 'solana'>, string> = {
  ethereum: 'eth-mainnet',
  base: 'base-mainnet',
  arbitrum: 'arb-mainnet',
  polygon: 'polygon-mainnet',
};

function getBaseUrl(chainId: Exclude<ChainId, 'solana'>): string {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    throw new Error('ALCHEMY_API_KEY not configured');
  }
  const network = NETWORK_MAP[chainId];
  return `https://${network}.g.alchemy.com/v2/${apiKey}`;
}

async function rpcCall<T>(
  chainId: Exclude<ChainId, 'solana'>,
  method: string,
  params: unknown[]
): Promise<T> {
  const response = await fetch(getBaseUrl(chainId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`Alchemy RPC error: ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`Alchemy RPC error: ${data.error.message}`);
  }

  return data.result;
}

export async function getTokenMetadata(
  chainId: Exclude<ChainId, 'solana'>,
  tokenAddress: string
): Promise<AlchemyTokenMetadata | null> {
  try {
    const result = await rpcCall<AlchemyTokenMetadata>(
      chainId,
      'alchemy_getTokenMetadata',
      [tokenAddress]
    );
    return result;
  } catch {
    return null;
  }
}

export async function getTokenBalances(
  chainId: Exclude<ChainId, 'solana'>,
  ownerAddress: string,
  tokenAddresses?: string[]
): Promise<{ contractAddress: string; tokenBalance: string }[]> {
  try {
    const params: unknown[] = [ownerAddress];
    if (tokenAddresses) {
      params.push(tokenAddresses);
    } else {
      params.push('erc20');
    }

    const result = await rpcCall<{ tokenBalances: { contractAddress: string; tokenBalance: string }[] }>(
      chainId,
      'alchemy_getTokenBalances',
      params
    );
    return result.tokenBalances || [];
  } catch {
    return [];
  }
}

export async function getContractMetadata(
  chainId: Exclude<ChainId, 'solana'>,
  contractAddress: string
): Promise<AlchemyContractMetadata | null> {
  try {
    const result = await rpcCall<AlchemyContractMetadata>(
      chainId,
      'alchemy_getContractMetadata',
      [contractAddress]
    );
    return result;
  } catch {
    return null;
  }
}

export async function isContractVerified(
  chainId: Exclude<ChainId, 'solana'>,
  contractAddress: string
): Promise<boolean> {
  try {
    // Check if contract code exists
    const code = await rpcCall<string>(chainId, 'eth_getCode', [
      contractAddress,
      'latest',
    ]);

    // If there's code, we'd need to check Etherscan/Basescan for verification
    // This is a simplified check - in production, you'd call the block explorer API
    return code !== '0x' && code.length > 100;
  } catch {
    return false;
  }
}

export async function getOwner(
  chainId: Exclude<ChainId, 'solana'>,
  contractAddress: string
): Promise<string | null> {
  try {
    // Standard owner() function selector
    const ownerSelector = '0x8da5cb5b';

    const result = await rpcCall<string>(chainId, 'eth_call', [
      {
        to: contractAddress,
        data: ownerSelector,
      },
      'latest',
    ]);

    if (result === '0x' || result.length < 66) {
      return null;
    }

    // Decode address from result
    return '0x' + result.slice(26);
  } catch {
    return null;
  }
}

export async function getTotalSupply(
  chainId: Exclude<ChainId, 'solana'>,
  contractAddress: string
): Promise<bigint | null> {
  try {
    // totalSupply() function selector
    const totalSupplySelector = '0x18160ddd';

    const result = await rpcCall<string>(chainId, 'eth_call', [
      {
        to: contractAddress,
        data: totalSupplySelector,
      },
      'latest',
    ]);

    if (result === '0x') {
      return null;
    }

    return BigInt(result);
  } catch {
    return null;
  }
}

export async function getTokenInfo(
  chainId: Exclude<ChainId, 'solana'>,
  tokenAddress: string
): Promise<Token | null> {
  try {
    const metadata = await getTokenMetadata(chainId, tokenAddress);
    if (!metadata) return null;

    return {
      address: tokenAddress,
      chainId,
      symbol: metadata.symbol,
      name: metadata.name,
      decimals: metadata.decimals,
      logoUrl: metadata.logo,
    };
  } catch {
    return null;
  }
}

export async function getHolderCount(
  chainId: Exclude<ChainId, 'solana'>,
  tokenAddress: string
): Promise<number> {
  // Alchemy doesn't directly provide holder count
  // You'd need to use their Transfers API or a third-party service
  // This is a placeholder - in production, consider using:
  // - Etherscan API
  // - Covalent API
  // - Custom indexer
  return 0;
}
