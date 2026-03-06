export const getWhaleHoldersTool = {
    name: 'get_whale_holders',
    description: 'Get the largest holders of a token and their percentage of total supply. ' +
        'Use this to assess concentration risk — if the top 10 holders own more than 50%, ' +
        'the token is vulnerable to coordinated selling. Holders are tagged (DEX, Burn, Team, LP) when identifiable. ' +
        'Locked and contract wallets are flagged separately.',
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
export async function handleGetWhaleHolders(client, args) {
    const data = await client.get(`/api/whale/holders/${args.chain}/${args.address}`);
    const holders = data.holders || [];
    const top10Pct = holders.slice(0, 10).reduce((sum, h) => sum + h.percent, 0);
    const holderLines = holders.map((h, i) => {
        const flags = [
            h.isContract ? 'Contract' : null,
            h.isLocked ? 'Locked' : null,
            h.tag || null,
        ].filter(Boolean).join(', ');
        return `  ${i + 1}. ${h.address.slice(0, 8)}...${h.address.slice(-4)}  ${h.percent.toFixed(2)}%${flags ? `  [${flags}]` : ''}`;
    });
    const concentrationWarning = top10Pct > 50
        ? `⚠ HIGH CONCENTRATION: Top 10 hold ${top10Pct.toFixed(1)}% — significant rug pull risk`
        : `✓ Top 10 hold ${top10Pct.toFixed(1)}%`;
    const text = [
        `Top Holders for ${args.address} on ${args.chain}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Total holders: ${data.total}`,
        concentrationWarning,
        ``,
        ...holderLines,
    ].join('\n');
    return { content: [{ type: 'text', text }] };
}
//# sourceMappingURL=get-whale-holders.js.map