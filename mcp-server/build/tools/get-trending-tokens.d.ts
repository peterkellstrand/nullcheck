import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { NullcheckClient } from '../utils/client.js';
export declare const getTrendingTokensTool: Tool;
export declare function handleGetTrendingTokens(client: NullcheckClient, args: {
    chain?: string;
    limit?: number;
}): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
//# sourceMappingURL=get-trending-tokens.d.ts.map