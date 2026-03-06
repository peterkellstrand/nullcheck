import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { NullcheckClient } from '../utils/client.js';
export declare const getWhaleActivityTool: Tool;
export declare function handleGetWhaleActivity(client: NullcheckClient, args: {
    chain: string;
    address: string;
}): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
//# sourceMappingURL=get-whale-activity.d.ts.map