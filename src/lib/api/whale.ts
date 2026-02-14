import { ChainId } from '@/types/chain';
import { TokenHolder, WhaleActivity } from '@/types/whale';
import { getTokenSecurity } from './goplus';
import { getTopHolders as getHeliusTopHolders } from './helius';
import { getTokenMetrics } from './dexscreener';

/**
 * Get top token holders for any chain
 * Uses Helius for Solana, GoPlus for EVM chains
 */
export async function getTopHolders(
  chainId: ChainId,
  tokenAddress: string,
  limit: number = 20
): Promise<TokenHolder[]> {
  if (chainId === 'solana') {
    return getSolanaTopHolders(tokenAddress, limit);
  }
  return getEvmTopHolders(chainId, tokenAddress, limit);
}

/**
 * Get Solana top holders via Helius
 */
async function getSolanaTopHolders(
  tokenAddress: string,
  limit: number
): Promise<TokenHolder[]> {
  const holders = await getHeliusTopHolders(tokenAddress, limit);

  return holders.map((h) => ({
    address: h.address,
    balance: h.balance.toString(),
    percent: h.percent,
    isContract: false, // Helius doesn't provide this
    isLocked: false,
    tag: undefined,
  }));
}

/**
 * Get EVM top holders via GoPlus
 */
async function getEvmTopHolders(
  chainId: ChainId,
  tokenAddress: string,
  limit: number
): Promise<TokenHolder[]> {
  const security = await getTokenSecurity(chainId, tokenAddress);

  if (!security?.holders) {
    return [];
  }

  return security.holders.slice(0, limit).map((h) => ({
    address: h.address,
    balance: h.balance,
    percent: parseFloat(h.percent || '0') * 100,
    isContract: h.is_contract === 1,
    isLocked: h.is_locked === 1,
    tag: h.tag || undefined,
  }));
}

/**
 * Get whale activity summary for a token
 * Uses DexScreener transaction counts
 */
export async function getWhaleActivity(
  chainId: ChainId,
  tokenAddress: string
): Promise<WhaleActivity> {
  const metrics = await getTokenMetrics(chainId, tokenAddress);

  if (!metrics) {
    return {
      count24h: 0,
      buyCount24h: 0,
      sellCount24h: 0,
      netFlow24h: 0,
    };
  }

  const buys = metrics.buys24h || 0;
  const sells = metrics.sells24h || 0;
  const total = buys + sells;

  // Estimate whale transactions as roughly 10% of total transactions
  // In reality, you'd want to filter by transaction value
  const whaleEstimate = Math.floor(total * 0.1);

  return {
    count24h: whaleEstimate,
    buyCount24h: Math.floor(buys * 0.1),
    sellCount24h: Math.floor(sells * 0.1),
    netFlow24h: buys - sells, // Positive = more buys overall
  };
}

/**
 * Get detailed whale activity with transaction history
 * For now, returns activity summary - can be extended with explorer APIs
 */
export async function getDetailedWhaleActivity(
  chainId: ChainId,
  tokenAddress: string,
  _limit: number = 10
): Promise<WhaleActivity> {
  // For MVP, use the basic whale activity
  // In the future, integrate chain explorers for detailed transaction history:
  // - Solana: Helius transaction history API
  // - EVM: Etherscan/Basescan/Arbiscan APIs
  return getWhaleActivity(chainId, tokenAddress);
}
