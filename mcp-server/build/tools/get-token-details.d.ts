import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { NullcheckClient } from '../utils/client.js';
export declare const getTokenDetailsTool: Tool;
export declare function handleGetTokenDetails(client: NullcheckClient, args: {
    chain: string;
    address: string;
}): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
//# sourceMappingURL=get-token-details.d.ts.map