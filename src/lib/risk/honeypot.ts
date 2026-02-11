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

export function simulateTrade(
  buyTax: number,
  sellTax: number,
  amount: number
): {
  netAmount: number;
  totalTax: number;
  warning?: string;
} {
  const buyAmount = amount * (1 - buyTax / 100);
  const sellAmount = buyAmount * (1 - sellTax / 100);
  const totalTax = ((amount - sellAmount) / amount) * 100;

  let warning: string | undefined;
  if (totalTax > 50) {
    warning = `Round-trip tax of ${totalTax.toFixed(1)}% - potential honeypot`;
  } else if (totalTax > 20) {
    warning = `High round-trip tax: ${totalTax.toFixed(1)}%`;
  }

  return {
    netAmount: sellAmount,
    totalTax,
    warning,
  };
}
