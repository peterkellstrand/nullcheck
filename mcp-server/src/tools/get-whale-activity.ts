import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { NullcheckClient } from '../utils/client.js';
import type { WhaleActivity } from '../utils/types.js';

export const getWhaleActivityTool: Tool = {
  name: 'get_whale_activity',
  description:
    'Track large wallet transactions (>$10k or >1% of supply) for a token over the past 24 hours. ' +
    'Positive netFlow24h means more buys than sells — indicates whale accumulation (bullish signal). ' +
    'Negative netFlow24h means selling pressure (bearish). Includes the largest transaction and recent trades.',
  inputSchema: {
    type: 'object' as const,
    required: ['chain', 'address'],
    properties: {
      chain: {
        type: 'string',
        enum: ['ethereum', 'base', 'solana'],
        description: 'Blockchain network',
      },
      address: {
        type: 'string',
        description: 'Token contract address',
      },
    },
  },
};

export async function handleGetWhaleActivity(
  client: NullcheckClient,
  args: { chain: string; address: string }
) {
  const data = await client.get<WhaleActivity>(
    `/api/whale/activity/${args.chain}/${args.address}`
  );

  const sentiment = data.netFlow24h > 0 ? 'BULLISH (net buying)' : data.netFlow24h < 0 ? 'BEARISH (net selling)' : 'NEUTRAL';

  const txLines = (data.recentTransactions || []).slice(0, 5).map((tx) =>
    `  ${tx.type.toUpperCase()} $${formatNum(tx.valueUsd)} by ${tx.walletAddress.slice(0, 8)}...${tx.walletAddress.slice(-4)}`
  );

  const text = [
    `Whale Activity for ${args.address} on ${args.chain}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Signal: ${sentiment}`,
    `Total whale txs (24h): ${data.count24h}`,
    `  Buys: ${data.buyCount24h}  |  Sells: ${data.sellCount24h}  |  Net flow: ${data.netFlow24h > 0 ? '+' : ''}${data.netFlow24h}`,
    data.largestTx ? `Largest: ${data.largestTx.type.toUpperCase()} $${formatNum(data.largestTx.valueUsd)}` : '',
    ``,
    `Recent transactions:`,
    txLines.length > 0 ? txLines.join('\n') : '  No recent whale transactions',
  ].filter(Boolean).join('\n');

  return { content: [{ type: 'text' as const, text }] };
}

function formatNum(n?: number): string {
  if (n === undefined || n === null) return '?';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}
