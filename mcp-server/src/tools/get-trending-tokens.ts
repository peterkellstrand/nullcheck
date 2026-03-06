import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { NullcheckClient } from '../utils/client.js';
import type { TokenWithMetrics } from '../utils/types.js';

export const getTrendingTokensTool: Tool = {
  name: 'get_trending_tokens',
  description:
    'Find tokens currently trending across DEXes, ranked by volume and activity. ' +
    'Returns price, volume, liquidity, and risk scores. Use this for discovering new opportunities. ' +
    'Always follow up with check_token_risk before acting on any token. Filter by chain to narrow scope.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      chain: {
        type: 'string',
        enum: ['ethereum', 'base', 'solana'],
        description: 'Filter to a specific chain. Omit for all chains.',
      },
      limit: {
        type: 'number',
        description: 'Max tokens to return (1-100). Default 20.',
      },
    },
  },
};

export async function handleGetTrendingTokens(
  client: NullcheckClient,
  args: { chain?: string; limit?: number }
) {
  const result = await client.get<{ tokens: TokenWithMetrics[]; meta: { count: number } }>(
    '/api/tokens',
    { chain: args.chain, limit: args.limit || 20 }
  );

  const tokens = result.tokens || [];
  if (tokens.length === 0) {
    return { content: [{ type: 'text' as const, text: 'No trending tokens found for the specified filters.' }] };
  }

  const lines = tokens.map((t, i) => {
    const risk = t.risk ? ` | Risk: ${t.risk.totalScore}/100 (${t.risk.level})` : '';
    const change = t.metrics?.priceChange24h !== undefined ? ` | 24h: ${t.metrics.priceChange24h > 0 ? '+' : ''}${t.metrics.priceChange24h.toFixed(1)}%` : '';
    return `${i + 1}. ${t.symbol} (${t.name}) on ${t.chainId}${change}${risk}` +
      `\n   Price: $${t.metrics?.price?.toPrecision(4) ?? '?'} | Vol: $${formatNum(t.metrics?.volume24h)} | Liq: $${formatNum(t.metrics?.liquidity)}` +
      `\n   Address: ${t.address}`;
  });

  const text = [
    `Trending Tokens${args.chain ? ` on ${args.chain}` : ''} (${tokens.length} results)`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ...lines,
  ].join('\n');

  return { content: [{ type: 'text' as const, text }] };
}

function formatNum(n?: number): string {
  if (n === undefined || n === null) return '?';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}
