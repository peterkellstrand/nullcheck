export const searchTokensTool = {
    name: 'search_tokens',
    description: 'Find a token by name, symbol, or contract address across Ethereum, Base, and Solana. ' +
        'Use this when you know what token to look for but need the exact contract address or chain. ' +
        'Returns basic token info — use get_token_details or check_token_risk for full data.',
    inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
            query: {
                type: 'string',
                description: 'Token name, symbol (e.g. "PEPE"), or contract address. Min 2 characters.',
            },
            chain: {
                type: 'string',
                enum: ['ethereum', 'base', 'solana'],
                description: 'Limit search to a specific chain',
            },
            limit: {
                type: 'number',
                description: 'Max results. Default 10.',
            },
        },
    },
};
export async function handleSearchTokens(client, args) {
    const result = await client.get('/api/search', {
        q: args.query,
        chain: args.chain,
        limit: args.limit || 10,
    });
    const tokens = result.results || [];
    if (tokens.length === 0) {
        return { content: [{ type: 'text', text: `No tokens found matching "${args.query}".` }] };
    }
    const lines = tokens.map((t, i) => `${i + 1}. ${t.symbol} (${t.name}) on ${t.chainId}\n   Address: ${t.address}`);
    const text = [
        `Search results for "${args.query}" (${tokens.length} found)`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ...lines,
    ].join('\n');
    return { content: [{ type: 'text', text }] };
}
//# sourceMappingURL=search-tokens.js.map