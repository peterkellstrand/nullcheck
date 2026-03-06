import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { NullcheckClient } from '../utils/client.js';
export declare const batchRiskCheckTool: Tool;
export declare function handleBatchRiskCheck(client: NullcheckClient, args: {
    tokens: Array<{
        chain: string;
        address: string;
    }>;
}): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
//# sourceMappingURL=batch-risk-check.d.ts.map