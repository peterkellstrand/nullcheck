import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { NullcheckClient } from '../utils/client.js';
export declare const checkTokenRiskTool: Tool;
export declare function handleCheckTokenRisk(client: NullcheckClient, args: {
    chain: string;
    address: string;
    force?: boolean;
}): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
//# sourceMappingURL=check-token-risk.d.ts.map