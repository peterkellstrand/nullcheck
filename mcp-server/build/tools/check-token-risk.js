export const checkTokenRiskTool = {
    name: 'check_token_risk',
    description: 'Analyze a DeFi token for honeypot traps, rug pull risk, contract vulnerabilities, and liquidity issues. ' +
        'Returns a risk score from 0-100: LOW (0-14) is generally safe, MEDIUM (15-29) has some concerns, ' +
        'HIGH (30-49) has significant red flags, CRITICAL (50-100) is likely a scam. ' +
        'Always run this before buying an unfamiliar token. If isHoneypot is true, do NOT buy — you will not be able to sell.',
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
            force: {
                type: 'boolean',
                description: 'Force fresh analysis, bypassing cache. Default false.',
            },
        },
    },
};
export async function handleCheckTokenRisk(client, args) {
    const data = await client.post(`/api/risk/${args.chain}/${args.address}`, { force: args.force || false });
    const warnings = data.warnings?.map((w) => `  - [${w.severity.toUpperCase()}] ${w.message}`).join('\n') || '  None';
    const text = [
        `Risk Analysis for ${args.address} on ${args.chain}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Overall: ${data.totalScore}/100 (${data.level.toUpperCase()})`,
        ``,
        `Honeypot:    ${data.honeypot?.score ?? '?'}/50  ${data.honeypot?.isHoneypot ? '⚠ HONEYPOT DETECTED — DO NOT BUY' : '✓ Can sell'}`,
        `  Buy tax: ${data.honeypot?.buyTax ?? '?'}%  |  Sell tax: ${data.honeypot?.sellTax ?? '?'}%`,
        `Contract:    ${data.contract?.score ?? '?'}/30  ${data.contract?.verified ? '✓ Verified' : '✗ Unverified'}  ${data.contract?.renounced ? '✓ Renounced' : '✗ Not renounced'}`,
        `  Mint function: ${data.contract?.hasMintFunction ? 'Yes ⚠' : 'No'}  |  Max tax: ${data.contract?.maxTaxPercent ?? '?'}%`,
        `Holders:     ${data.holders?.score ?? '?'}/25  ${data.holders?.totalHolders ?? '?'} holders`,
        `  Top 10 hold: ${data.holders?.top10Percent ?? '?'}%  |  Creator holds: ${data.holders?.creatorHoldingPercent ?? '?'}%`,
        `Liquidity:   ${data.liquidity?.score ?? '?'}/25  $${formatNum(data.liquidity?.liquidity)}`,
        `  LP locked: ${data.liquidity?.lpLocked ? `Yes (${data.liquidity?.lpLockedPercent}%)` : 'No ⚠'}`,
        ``,
        `Warnings:`,
        warnings,
        ``,
        `Analyzed at: ${data.analyzedAt || 'just now'}`,
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
//# sourceMappingURL=check-token-risk.js.map