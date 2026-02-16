import { ChainId } from '@/types/chain';
import { ContractRisk, RiskWarning } from '@/types/risk';
import { goplus, alchemy } from '@/lib/api';

export async function analyzeContract(
  chainId: ChainId,
  tokenAddress: string
): Promise<ContractRisk> {
  try {
    if (chainId === 'solana') {
      return analyzeSolanaToken(tokenAddress);
    }

    return analyzeEvmContract(chainId, tokenAddress);
  } catch (error) {
    console.error('Contract analysis error:', error);
    return {
      score: 15,
      verified: false,
      renounced: false,
      hasProxy: false,
      hasMintFunction: false,
      hasPauseFunction: false,
      hasBlacklistFunction: false,
      maxTaxPercent: 0,
      warnings: [
        {
          code: 'ANALYSIS_FAILED',
          severity: 'high',
          message: 'Contract analysis failed',
        },
      ],
    };
  }
}

async function analyzeEvmContract(
  chainId: Exclude<ChainId, 'solana'>,
  tokenAddress: string
): Promise<ContractRisk> {
  const [security, isVerified, owner] = await Promise.all([
    goplus.getTokenSecurity(chainId, tokenAddress),
    alchemy.isContractVerified(chainId, tokenAddress).catch(() => false),
    alchemy.getOwner(chainId, tokenAddress).catch(() => null),
  ]);

  const baseAnalysis = goplus.analyzeContractRisk(security);

  // Enhance with Alchemy data
  const warnings = [...baseAnalysis.warnings];
  let score = baseAnalysis.score;

  // Check if ownership is renounced (zero address or null)
  const isRenounced =
    !owner ||
    owner === '0x0000000000000000000000000000000000000000' ||
    owner === '0x000000000000000000000000000000000000dead';

  if (!isRenounced && !baseAnalysis.renounced) {
    // Already accounted for in GoPlus analysis
  }

  return {
    ...baseAnalysis,
    verified: isVerified || baseAnalysis.verified,
    renounced: isRenounced,
    warnings,
  };
}

async function analyzeSolanaToken(tokenAddress: string): Promise<ContractRisk> {
  const warnings: RiskWarning[] = [];
  let score = 0;

  // Solana tokens (SPL) have different security model
  // - Mint authority can create new tokens
  // - Freeze authority can freeze accounts
  // - These can be revoked

  try {
    // In production, you'd check mint/freeze authorities
    // For now, return a neutral analysis
    return {
      score: 5,
      verified: true, // SPL tokens are "verified" by nature
      renounced: false, // Would check mint authority
      hasProxy: false, // SPL tokens don't have proxies
      hasMintFunction: true, // Check if mint authority is null
      hasPauseFunction: false,
      hasBlacklistFunction: false,
      maxTaxPercent: 0,
      warnings: [
        {
          code: 'SOLANA_TOKEN',
          severity: 'low',
          message: 'SPL token - check mint/freeze authorities',
        },
      ],
    };
  } catch {
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
          code: 'SOLANA_API_ERROR',
          severity: 'medium',
          message: 'Solana token analysis unavailable',
        },
      ],
    };
  }
}

