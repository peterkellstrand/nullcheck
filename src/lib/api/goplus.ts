import { ChainId } from '@/types/chain';
import {
  GoPlusSecurityResponse,
  GoPlusTokenSecurity,
  GoPlusHolder,
  GoPlusLPHolder,
} from '@/types/api';
import {
  HoneypotRisk,
  ContractRisk,
  HolderRisk,
  LiquidityRisk,
  RiskWarning,
} from '@/types/risk';

const BASE_URL = 'https://api.gopluslabs.io/api/v1';

const CHAIN_ID_MAP: Record<ChainId, string> = {
  ethereum: '1',
  base: '8453',
  solana: 'solana',
};

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Accept: 'application/json',
    },
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!response.ok) {
    throw new Error(`GoPlus API error: ${response.status}`);
  }

  return response.json();
}

export async function getTokenSecurity(
  chainId: ChainId,
  tokenAddress: string
): Promise<GoPlusTokenSecurity | null> {
  const chain = CHAIN_ID_MAP[chainId];

  // Solana uses a different endpoint
  if (chainId === 'solana') {
    return getSolanaTokenSecurity(tokenAddress);
  }

  const data = await fetchApi<GoPlusSecurityResponse>(
    `/token_security/${chain}?contract_addresses=${tokenAddress}`
  );

  if (data.code !== 1 || !data.result) {
    return null;
  }

  const addressLower = tokenAddress.toLowerCase();
  return data.result[addressLower] || null;
}

async function getSolanaTokenSecurity(
  tokenAddress: string
): Promise<GoPlusTokenSecurity | null> {
  try {
    const data = await fetchApi<GoPlusSecurityResponse>(
      `/solana/token_security?contract_addresses=${tokenAddress}`
    );

    if (data.code !== 1 || !data.result) {
      return null;
    }

    return data.result[tokenAddress] || null;
  } catch {
    return null;
  }
}

export function analyzeHoneypotRisk(
  security: GoPlusTokenSecurity | null
): HoneypotRisk {
  const warnings: RiskWarning[] = [];
  let score = 0;

  if (!security) {
    return {
      score: 0,
      isHoneypot: false,
      buyTax: 0,
      sellTax: 0,
      transferTax: 0,
      cannotSell: false,
      cannotTransfer: false,
      warnings: [
        {
          code: 'NO_DATA',
          severity: 'medium',
          message: 'Unable to verify token security',
        },
      ],
    };
  }

  const isHoneypot = security.is_honeypot === '1';
  const buyTax = parseFloat(security.buy_tax || '0') * 100;
  const sellTax = parseFloat(security.sell_tax || '0') * 100;
  const cannotSell = security.cannot_sell_all === '1';

  if (isHoneypot) {
    score += 50;
    warnings.push({
      code: 'HONEYPOT',
      severity: 'critical',
      message: 'Token is a honeypot - cannot sell',
    });
  }

  if (cannotSell) {
    score += 40;
    warnings.push({
      code: 'CANNOT_SELL',
      severity: 'critical',
      message: 'Cannot sell all tokens',
    });
  }

  if (sellTax > 50) {
    score += 30;
    warnings.push({
      code: 'HIGH_SELL_TAX',
      severity: 'critical',
      message: `Extremely high sell tax: ${sellTax.toFixed(1)}%`,
    });
  } else if (sellTax > 20) {
    score += 15;
    warnings.push({
      code: 'ELEVATED_SELL_TAX',
      severity: 'high',
      message: `High sell tax: ${sellTax.toFixed(1)}%`,
    });
  } else if (sellTax > 10) {
    score += 5;
    warnings.push({
      code: 'SELL_TAX',
      severity: 'medium',
      message: `Sell tax: ${sellTax.toFixed(1)}%`,
    });
  }

  if (buyTax > 20) {
    score += 10;
    warnings.push({
      code: 'HIGH_BUY_TAX',
      severity: 'high',
      message: `High buy tax: ${buyTax.toFixed(1)}%`,
    });
  }

  return {
    score: Math.min(score, 50),
    isHoneypot,
    buyTax,
    sellTax,
    transferTax: 0,
    cannotSell,
    cannotTransfer: false,
    warnings,
  };
}

export function analyzeContractRisk(
  security: GoPlusTokenSecurity | null
): ContractRisk {
  const warnings: RiskWarning[] = [];
  let score = 0;

  if (!security) {
    return {
      score: 10,
      verified: false,
      renounced: false,
      hasProxy: false,
      hasMintFunction: false,
      hasPauseFunction: false,
      hasBlacklistFunction: false,
      maxTaxPercent: 0,
      warnings: [
        {
          code: 'UNVERIFIED',
          severity: 'medium',
          message: 'Contract verification status unknown',
        },
      ],
    };
  }

  const isOpenSource = security.is_open_source === '1';
  const isProxy = security.is_proxy === '1';
  const isMintable = security.is_mintable === '1';
  const canTakeBackOwnership = security.can_take_back_ownership === '1';
  const ownerChangeBalance = security.owner_change_balance === '1';
  const hasHiddenOwner = security.hidden_owner === '1';
  const isPausable = security.transfer_pausable === '1';
  const hasBlacklist = security.is_blacklisted === '1';
  const slippageModifiable = security.slippage_modifiable === '1';

  if (!isOpenSource) {
    score += 15;
    warnings.push({
      code: 'NOT_OPEN_SOURCE',
      severity: 'high',
      message: 'Contract source code not verified',
    });
  }

  if (isProxy) {
    score += 5;
    warnings.push({
      code: 'PROXY_CONTRACT',
      severity: 'medium',
      message: 'Contract uses proxy pattern - can be upgraded',
    });
  }

  if (isMintable) {
    score += 10;
    warnings.push({
      code: 'MINTABLE',
      severity: 'high',
      message: 'Owner can mint new tokens',
    });
  }

  if (canTakeBackOwnership) {
    score += 15;
    warnings.push({
      code: 'RECLAIM_OWNERSHIP',
      severity: 'critical',
      message: 'Owner can reclaim ownership after renouncing',
    });
  }

  if (ownerChangeBalance) {
    score += 20;
    warnings.push({
      code: 'OWNER_MODIFY_BALANCE',
      severity: 'critical',
      message: 'Owner can modify token balances',
    });
  }

  if (hasHiddenOwner) {
    score += 10;
    warnings.push({
      code: 'HIDDEN_OWNER',
      severity: 'high',
      message: 'Contract has hidden owner',
    });
  }

  if (isPausable) {
    score += 5;
    warnings.push({
      code: 'PAUSABLE',
      severity: 'medium',
      message: 'Trading can be paused',
    });
  }

  if (hasBlacklist) {
    score += 5;
    warnings.push({
      code: 'BLACKLIST',
      severity: 'medium',
      message: 'Contract has blacklist function',
    });
  }

  if (slippageModifiable) {
    score += 10;
    warnings.push({
      code: 'MODIFIABLE_TAX',
      severity: 'high',
      message: 'Tax/slippage can be modified',
    });
  }

  return {
    score: Math.min(score, 30),
    verified: isOpenSource,
    renounced: !hasHiddenOwner && !canTakeBackOwnership,
    hasProxy: isProxy,
    hasMintFunction: isMintable,
    hasPauseFunction: isPausable,
    hasBlacklistFunction: hasBlacklist,
    maxTaxPercent: Math.max(
      parseFloat(security.buy_tax || '0') * 100,
      parseFloat(security.sell_tax || '0') * 100
    ),
    warnings,
  };
}

export function analyzeHolderRisk(
  security: GoPlusTokenSecurity | null
): HolderRisk {
  const warnings: RiskWarning[] = [];
  let score = 0;

  if (!security || !security.holders) {
    return {
      score: 5,
      totalHolders: 0,
      top10Percent: 0,
      top20Percent: 0,
      creatorHoldingPercent: 0,
      warnings: [
        {
          code: 'NO_HOLDER_DATA',
          severity: 'low',
          message: 'Holder data unavailable',
        },
      ],
    };
  }

  const totalHolders = parseInt(security.holder_count || '0');
  const creatorPercent = parseFloat(security.creator_percent || '0') * 100;

  // Calculate top holder concentration
  const holders = security.holders || [];
  const top10 = holders
    .slice(0, 10)
    .reduce((sum, h) => sum + parseFloat(h.percent || '0') * 100, 0);
  const top20 = holders
    .slice(0, 20)
    .reduce((sum, h) => sum + parseFloat(h.percent || '0') * 100, 0);

  if (totalHolders < 50) {
    score += 10;
    warnings.push({
      code: 'FEW_HOLDERS',
      severity: 'high',
      message: `Only ${totalHolders} holders`,
    });
  } else if (totalHolders < 200) {
    score += 5;
    warnings.push({
      code: 'LOW_HOLDERS',
      severity: 'medium',
      message: `${totalHolders} holders`,
    });
  }

  if (top10 > 80) {
    score += 15;
    warnings.push({
      code: 'EXTREME_CONCENTRATION',
      severity: 'critical',
      message: `Top 10 wallets hold ${top10.toFixed(1)}%`,
    });
  } else if (top10 > 60) {
    score += 10;
    warnings.push({
      code: 'HIGH_CONCENTRATION',
      severity: 'high',
      message: `Top 10 wallets hold ${top10.toFixed(1)}%`,
    });
  } else if (top10 > 40) {
    score += 5;
    warnings.push({
      code: 'MODERATE_CONCENTRATION',
      severity: 'medium',
      message: `Top 10 wallets hold ${top10.toFixed(1)}%`,
    });
  }

  if (creatorPercent > 20) {
    score += 10;
    warnings.push({
      code: 'CREATOR_HOLDING',
      severity: 'high',
      message: `Creator holds ${creatorPercent.toFixed(1)}%`,
    });
  } else if (creatorPercent > 10) {
    score += 5;
    warnings.push({
      code: 'CREATOR_HOLDING',
      severity: 'medium',
      message: `Creator holds ${creatorPercent.toFixed(1)}%`,
    });
  }

  return {
    score: Math.min(score, 25),
    totalHolders,
    top10Percent: top10,
    top20Percent: top20,
    creatorHoldingPercent: creatorPercent,
    warnings,
  };
}

export function analyzeLiquidityRisk(
  security: GoPlusTokenSecurity | null,
  liquidityUsd: number
): LiquidityRisk {
  const warnings: RiskWarning[] = [];
  let score = 0;

  const lpHolders = security?.lp_holders || [];
  const lockedLp = lpHolders.filter((h) => h.is_locked === 1);
  const totalLpPercent = lpHolders.reduce(
    (sum, h) => sum + parseFloat(h.percent || '0') * 100,
    0
  );
  const lockedPercent = lockedLp.reduce(
    (sum, h) => sum + parseFloat(h.percent || '0') * 100,
    0
  );

  // Check liquidity amount
  if (liquidityUsd < 10000) {
    score += 15;
    warnings.push({
      code: 'VERY_LOW_LIQUIDITY',
      severity: 'critical',
      message: `Liquidity under $10k ($${liquidityUsd.toLocaleString()})`,
    });
  } else if (liquidityUsd < 50000) {
    score += 10;
    warnings.push({
      code: 'LOW_LIQUIDITY',
      severity: 'high',
      message: `Low liquidity: $${liquidityUsd.toLocaleString()}`,
    });
  } else if (liquidityUsd < 100000) {
    score += 5;
    warnings.push({
      code: 'MODERATE_LIQUIDITY',
      severity: 'medium',
      message: `Moderate liquidity: $${liquidityUsd.toLocaleString()}`,
    });
  }

  // Check LP lock status
  if (lockedPercent < 50 && liquidityUsd > 10000) {
    score += 10;
    warnings.push({
      code: 'LP_NOT_LOCKED',
      severity: 'high',
      message: `Only ${lockedPercent.toFixed(1)}% LP locked`,
    });
  } else if (lockedPercent < 80) {
    score += 5;
    warnings.push({
      code: 'LP_PARTIALLY_LOCKED',
      severity: 'medium',
      message: `${lockedPercent.toFixed(1)}% LP locked`,
    });
  }

  return {
    score: Math.min(score, 25),
    liquidity: liquidityUsd,
    lpLocked: lockedPercent >= 80,
    lpLockedPercent: lockedPercent,
    lpBurnedPercent: 0, // Would need additional data
    warnings,
  };
}
