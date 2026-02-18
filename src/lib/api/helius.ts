import { HeliusAsset, HeliusHolders, HeliusTokenAccount } from '@/types/api';
import { Token } from '@/types/token';
import { RiskWarning } from '@/types/risk';
import { checkRateLimit } from './rate-limiter';

const getBaseUrl = () => {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    throw new Error('HELIUS_API_KEY not configured');
  }
  return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
};

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  await checkRateLimit('helius');

  const response = await fetch(getBaseUrl(), {
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
    throw new Error(`Helius RPC error: ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`Helius RPC error: ${data.error.message}`);
  }

  return data.result;
}

export async function getAsset(tokenAddress: string): Promise<HeliusAsset | null> {
  try {
    const result = await rpcCall<HeliusAsset>('getAsset', [tokenAddress]);
    return result;
  } catch {
    return null;
  }
}

export async function getAssetsByOwner(
  ownerAddress: string,
  page: number = 1,
  limit: number = 1000
): Promise<HeliusAsset[]> {
  try {
    const result = await rpcCall<{ items: HeliusAsset[] }>('getAssetsByOwner', [
      {
        ownerAddress,
        page,
        limit,
      },
    ]);
    return result.items || [];
  } catch {
    return [];
  }
}

export async function getTokenAccounts(
  mintAddress: string,
  page: number = 1,
  limit: number = 100
): Promise<HeliusTokenAccount[]> {
  try {
    const result = await rpcCall<{ token_accounts: HeliusTokenAccount[] }>(
      'getTokenAccounts',
      [
        {
          mint: mintAddress,
          page,
          limit,
        },
      ]
    );
    return result.token_accounts || [];
  } catch {
    return [];
  }
}

export async function getTokenHolderCount(mintAddress: string): Promise<number> {
  try {
    // Use DAS API to get approximate holder count
    const accounts = await getTokenAccounts(mintAddress, 1, 1);
    // This is a rough estimate - for accurate count we'd need to paginate through all
    // In production, you'd want to use a dedicated holder count API
    return accounts.length > 0 ? 100 : 0; // Placeholder
  } catch {
    return 0;
  }
}

export async function getTopHolders(
  mintAddress: string,
  limit: number = 20
): Promise<{ address: string; balance: number; percent: number }[]> {
  try {
    // Use standard Solana RPC method for largest token accounts
    const result = await rpcCall<{
      value: Array<{
        address: string;
        amount: string;
        decimals: number;
        uiAmount: number | null;
        uiAmountString: string;
      }>;
    }>('getTokenLargestAccounts', [mintAddress]);

    if (!result?.value || result.value.length === 0) {
      console.log('getTokenLargestAccounts returned no results for', mintAddress);
      return [];
    }

    // Calculate total from largest accounts for percentage
    const totalAmount = result.value.reduce(
      (sum, acc) => sum + parseFloat(acc.amount),
      0
    );

    // For each token account, we need to get the owner
    // The address returned is the token account, not the wallet
    const holdersWithOwners = await Promise.all(
      result.value.slice(0, limit).map(async (acc) => {
        try {
          // Get account info to find the owner
          const accountInfo = await rpcCall<{
            value: {
              data: {
                parsed: {
                  info: {
                    owner: string;
                    tokenAmount: {
                      amount: string;
                      decimals: number;
                      uiAmount: number;
                    };
                  };
                };
              };
            } | null;
          }>('getAccountInfo', [
            acc.address,
            { encoding: 'jsonParsed' }
          ]);

          const owner = accountInfo?.value?.data?.parsed?.info?.owner || acc.address;
          const balance = parseFloat(acc.amount);

          return {
            address: owner,
            balance,
            percent: totalAmount > 0 ? (balance / totalAmount) * 100 : 0,
          };
        } catch {
          // If we can't get owner, use token account address
          return {
            address: acc.address,
            balance: parseFloat(acc.amount),
            percent: totalAmount > 0 ? (parseFloat(acc.amount) / totalAmount) * 100 : 0,
          };
        }
      })
    );

    return holdersWithOwners;
  } catch (error) {
    console.error('Error fetching Solana top holders:', error);
    return [];
  }
}

export async function getTokenMetadata(
  mintAddress: string
): Promise<Token | null> {
  try {
    const asset = await getAsset(mintAddress);
    if (!asset) return null;

    return {
      address: mintAddress,
      chainId: 'solana',
      symbol: asset.content.metadata.symbol,
      name: asset.content.metadata.name,
      decimals: asset.token_info?.decimals || 9,
      logoUrl: asset.content.links?.image,
      totalSupply: asset.token_info?.supply?.toString(),
    };
  } catch {
    return null;
  }
}

export function analyzeHolderDistribution(
  holders: { address: string; balance: number; percent: number }[]
): {
  top10Percent: number;
  top20Percent: number;
  warnings: RiskWarning[];
} {
  const warnings: RiskWarning[] = [];
  const top10 = holders.slice(0, 10).reduce((sum, h) => sum + h.percent, 0);
  const top20 = holders.slice(0, 20).reduce((sum, h) => sum + h.percent, 0);

  if (top10 > 80) {
    warnings.push({
      code: 'EXTREME_CONCENTRATION',
      severity: 'critical',
      message: `Top 10 wallets hold ${top10.toFixed(1)}%`,
    });
  } else if (top10 > 60) {
    warnings.push({
      code: 'HIGH_CONCENTRATION',
      severity: 'high',
      message: `Top 10 wallets hold ${top10.toFixed(1)}%`,
    });
  }

  // Check for single whale
  if (holders.length > 0 && holders[0].percent > 30) {
    warnings.push({
      code: 'WHALE_DETECTED',
      severity: 'high',
      message: `Single wallet holds ${holders[0].percent.toFixed(1)}%`,
    });
  }

  return { top10Percent: top10, top20Percent: top20, warnings };
}
