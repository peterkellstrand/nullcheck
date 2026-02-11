import { ChainId } from '@/types/chain';
import { TokenSnifferResponse, TokenSnifferTest } from '@/types/api';
import { RiskWarning, RiskLevel } from '@/types/risk';

const BASE_URL = 'https://tokensniffer.com/api/v2';

const CHAIN_ID_MAP: Record<ChainId, number> = {
  ethereum: 1,
  base: 8453,
  solana: -1, // Not supported
};

async function fetchApi<T>(endpoint: string, apiKey: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Accept: 'application/json',
      'X-API-Key': apiKey,
    },
    next: { revalidate: 600 }, // Cache for 10 minutes
  });

  if (!response.ok) {
    throw new Error(`TokenSniffer API error: ${response.status}`);
  }

  return response.json();
}

export async function getTokenAnalysis(
  chainId: ChainId,
  tokenAddress: string,
  apiKey?: string
): Promise<TokenSnifferResponse | null> {
  if (chainId === 'solana') {
    return null; // TokenSniffer doesn't support Solana
  }

  const key = apiKey || process.env.TOKENSNIFFER_API_KEY;
  if (!key) {
    return null;
  }

  const chain = CHAIN_ID_MAP[chainId];

  try {
    const data = await fetchApi<TokenSnifferResponse>(
      `/tokens/${chain}/${tokenAddress}`,
      key
    );
    return data;
  } catch {
    return null;
  }
}

export function parseTokenSnifferWarnings(
  analysis: TokenSnifferResponse | null
): RiskWarning[] {
  if (!analysis?.tests) {
    return [];
  }

  const warnings: RiskWarning[] = [];

  for (const test of analysis.tests) {
    if (test.result === 'FAIL' || test.result === 'WARNING') {
      const severity = mapTestSeverity(test);
      const message = formatTestMessage(test);

      warnings.push({
        code: test.id.toUpperCase(),
        severity,
        message,
        details: test.value,
      });
    }
  }

  return warnings;
}

export function calculateSnifferScore(
  analysis: TokenSnifferResponse | null
): number {
  if (!analysis) {
    return 0;
  }

  // TokenSniffer returns a score from 0-100 where higher is safer
  // We invert it so higher = more risky
  return Math.max(0, 100 - analysis.score);
}

export function hasScamSimilarity(
  analysis: TokenSnifferResponse | null
): boolean {
  if (!analysis?.similar_contracts) {
    return false;
  }

  return analysis.similar_contracts.some((c) => c.is_scam);
}

function mapTestSeverity(test: TokenSnifferTest): RiskLevel {
  const highRiskTests = [
    'is_honeypot',
    'can_take_back_ownership',
    'owner_can_change_balance',
    'is_proxy',
    'external_call',
    'hidden_owner',
  ];

  const criticalTests = [
    'is_honeypot',
    'can_take_back_ownership',
    'owner_can_change_balance',
  ];

  if (criticalTests.includes(test.id) && test.result === 'FAIL') {
    return 'critical';
  }

  if (highRiskTests.includes(test.id) && test.result === 'FAIL') {
    return 'high';
  }

  if (test.result === 'FAIL') {
    return 'medium';
  }

  return 'low';
}

function formatTestMessage(test: TokenSnifferTest): string {
  const messageMap: Record<string, string> = {
    is_honeypot: 'Token is a potential honeypot',
    is_proxy: 'Contract uses upgradeable proxy',
    is_mintable: 'Token can be minted',
    can_take_back_ownership: 'Ownership can be reclaimed',
    owner_can_change_balance: 'Owner can modify balances',
    hidden_owner: 'Contract has hidden owner',
    external_call: 'Contract makes external calls',
    selfdestruct: 'Contract can self-destruct',
    is_pausable: 'Trading can be paused',
    has_fee: `Trading fees detected: ${test.value || 'unknown'}%`,
    blacklist: 'Contract has blacklist function',
    whitelist: 'Contract has whitelist function',
    anti_whale: 'Anti-whale restrictions active',
    low_liquidity: 'Low liquidity detected',
    few_holders: 'Few token holders',
    high_concentration: 'High holder concentration',
    unlocked_liquidity: 'Liquidity not locked',
  };

  return messageMap[test.id] || test.message || `Test failed: ${test.id}`;
}
