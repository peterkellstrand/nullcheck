export const getTokenDetailsTool = {
    name: 'get_token_details',
    description: 'Get comprehensive data for a specific token: current price, 1h/24h price change, trading volume, ' +
        'liquidity, market cap, holder count, buy/sell transaction counts, and risk score if available. ' +
        'Use this after identifying a token via search or trending to get the full picture before making decisions.',
    inputSchema: {
        type: 'object',
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
export async function handleGetTokenDetails(client, args) {
    const data = await client.get(`/api/token/${args.chain}/${args.address}`);
    const m = data.metrics;
    const risk = data.risk;
    const text = [
        `${data.symbol} (${data.name}) on ${data.chainId}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Address: ${data.address}`,
        ``,
        `Price:      $${m?.price?.toPrecision(6) ?? '?'}`,
        `1h change:  ${formatChange(m?.priceChange1h)}`,
        `24h change: ${formatChange(m?.priceChange24h)}`,
        `Volume:     $${formatNum(m?.volume24h)}`,
        `Liquidity:  $${formatNum(m?.liquidity)}`,
        `Market cap: $${formatNum(m?.marketCap ?? undefined)}`,
        ``,
        `Transactions (24h): ${m?.txns24h ?? '?'} total (${m?.buys24h ?? '?'} buys, ${m?.sells24h ?? '?'} sells)`,
        risk ? `\nRisk: ${risk.totalScore}/100 (${risk.level.toUpperCase()})${risk.honeypot?.isHoneypot ? ' ⚠ HONEYPOT' : ''}` : '\nRisk: Not yet analyzed — use check_token_risk',
    ].join('\n');
    return { content: [{ type: 'text', text }] };
}
function formatNum(n) {
    if (n === undefined || n === null)
        return '?';
    if (n >= 1_000_000)
        return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)
        return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(2);
}
function formatChange(n) {
    if (n === undefined || n === null)
        return '?';
    return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}
//# sourceMappingURL=get-token-details.js.map