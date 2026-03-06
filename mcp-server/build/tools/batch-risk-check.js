export const batchRiskCheckTool = {
    name: 'batch_risk_check',
    description: 'Analyze multiple tokens for risk in a single request. Use this for portfolio screening or checking ' +
        'a list of tokens efficiently. Max 10 tokens per request on Developer tier, up to 100 on Business tier. ' +
        'Returns a risk score for each token. Cached results return instantly.',
    inputSchema: {
        type: 'object',
        required: ['tokens'],
        properties: {
            tokens: {
                type: 'array',
                description: 'Array of tokens to analyze (max 10 for Developer tier)',
                items: {
                    type: 'object',
                    required: ['chain', 'address'],
                    properties: {
                        chain: {
                            type: 'string',
                            enum: ['ethereum', 'base', 'solana'],
                        },
                        address: { type: 'string' },
                    },
                },
            },
        },
    },
};
export async function handleBatchRiskCheck(client, args) {
    const payload = {
        tokens: args.tokens.map((t) => ({
            address: t.address,
            chainId: t.chain,
        })),
    };
    const data = await client.post('/api/risk/batch', payload);
    const resultLines = Object.entries(data.results).map(([key, risk]) => {
        const honeypotFlag = risk.honeypot?.isHoneypot ? ' ⚠ HONEYPOT' : '';
        return `  ${key}: ${risk.totalScore}/100 (${risk.level.toUpperCase()})${honeypotFlag}`;
    });
    const errorLines = data.errors
        ? Object.entries(data.errors).map(([key, msg]) => `  ${key}: FAILED — ${msg}`)
        : [];
    const text = [
        `Batch Risk Analysis (${args.tokens.length} tokens)`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Results:`,
        ...resultLines,
        ...(errorLines.length > 0 ? [``, `Errors:`, ...errorLines] : []),
        ``,
        `Meta: ${data.meta.requested} requested, ${data.meta.succeeded ?? data.meta.analyzed ?? '?'} succeeded, ${data.meta.failed ?? 0} failed, ${data.meta.cached ?? 0} from cache`,
    ].join('\n');
    return { content: [{ type: 'text', text }] };
}
//# sourceMappingURL=batch-risk-check.js.map