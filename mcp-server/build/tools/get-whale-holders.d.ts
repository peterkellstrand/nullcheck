import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { NullcheckClient } from '../utils/client.js';
export declare const getWhaleHoldersTool: Tool;
export declare function handleGetWhaleHolders(client: NullcheckClient, args: {
    chain: string;
    address: string;
}): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
//# sourceMappingURL=get-whale-holders.d.ts.map