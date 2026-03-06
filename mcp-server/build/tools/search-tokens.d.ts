import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { NullcheckClient } from '../utils/client.js';
export declare const searchTokensTool: Tool;
export declare function handleSearchTokens(client: NullcheckClient, args: {
    query: string;
    chain?: string;
    limit?: number;
}): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
//# sourceMappingURL=search-tokens.d.ts.map