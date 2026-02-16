import { ChainId } from '@/types/chain';
import { HoneypotRisk, RiskWarning } from '@/types/risk';
import { goplus } from '@/lib/api';

export async function detectHoneypot(
  chainId: ChainId,
  tokenAddress: string
): Promise<HoneypotRisk> {
  const warnings: RiskWarning[] = [];
  let score = 0;

  try {
    const security = await goplus.getTokenSecurity(chainId, tokenAddress);

    if (!security) {
      return {
        score: 10,
        isHoneypot: false,
        buyTax: 0,
        sellTax: 0,
        transferTax: 0,
        cannotSell: false,
        cannotTransfer: false,
        warnings: [
          {
            code: 'UNVERIFIED',
            severity: 'medium',
            message: 'Unable to verify honeypot status',
          },
        ],
      };
    }

    // Use GoPlus analysis
    return goplus.analyzeHoneypotRisk(security);
  } catch (error) {
    console.error('Honeypot detection error:', error);
    return {
      score: 15,
      isHoneypot: false,
      buyTax: 0,
      sellTax: 0,
      transferTax: 0,
      cannotSell: false,
      cannotTransfer: false,
      warnings: [
        {
          code: 'API_ERROR',
          severity: 'medium',
          message: 'Honeypot check failed - proceed with caution',
        },
      ],
    };
  }
}

