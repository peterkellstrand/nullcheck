/**
 * HTTP client for the nullcheck API.
 * Handles authentication, error mapping, and timeouts.
 */
export declare class NullcheckClient {
    private baseUrl;
    private apiKey;
    constructor(apiKey: string, baseUrl?: string);
    get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T>;
    post<T>(path: string, body?: unknown): Promise<T>;
    private request;
}
export declare class NullcheckApiError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status: number);
    toToolResult(): {
        content: Array<{
            type: 'text';
            text: string;
        }>;
        isError: true;
    };
}
//# sourceMappingURL=client.d.ts.map