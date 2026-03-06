/**
 * HTTP client for the nullcheck API.
 * Handles authentication, error mapping, and timeouts.
 */
const DEFAULT_BASE_URL = 'https://api.nullcheck.io';
const REQUEST_TIMEOUT_MS = 30_000;
export class NullcheckClient {
    baseUrl;
    apiKey;
    constructor(apiKey, baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl || DEFAULT_BASE_URL;
    }
    async get(path, params) {
        const url = new URL(path, this.baseUrl);
        if (params) {
            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined) {
                    url.searchParams.set(key, String(value));
                }
            }
        }
        return this.request(url.toString(), { method: 'GET' });
    }
    async post(path, body) {
        return this.request(new URL(path, this.baseUrl).toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });
    }
    async request(url, init) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(url, {
                ...init,
                signal: controller.signal,
                headers: {
                    'X-API-Key': this.apiKey,
                    'Accept': 'application/json',
                    ...init.headers,
                },
            });
            const json = (await response.json());
            if (!response.ok || !json.success) {
                const code = json.error?.code || `HTTP_${response.status}`;
                const message = json.error?.message || response.statusText;
                throw new NullcheckApiError(code, message, response.status);
            }
            return json.data;
        }
        catch (error) {
            if (error instanceof NullcheckApiError)
                throw error;
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw new NullcheckApiError('TIMEOUT', `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`, 408);
            }
            throw new NullcheckApiError('NETWORK_ERROR', `Failed to reach nullcheck API: ${error instanceof Error ? error.message : String(error)}`, 0);
        }
        finally {
            clearTimeout(timeout);
        }
    }
}
export class NullcheckApiError extends Error {
    code;
    status;
    constructor(code, message, status) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = 'NullcheckApiError';
    }
    toToolResult() {
        let hint = '';
        switch (this.code) {
            case 'UNAUTHORIZED':
            case 'INVALID_KEY':
                hint = ' Check that NULLCHECK_API_KEY is set correctly.';
                break;
            case 'RATE_LIMITED':
                hint = ' You have exceeded your API quota. Check usage at nullcheck.io/keys.';
                break;
            case 'NOT_FOUND':
                hint = ' The token may not exist or may not be tracked yet.';
                break;
        }
        return {
            content: [{ type: 'text', text: `Error [${this.code}]: ${this.message}${hint}` }],
            isError: true,
        };
    }
}
//# sourceMappingURL=client.js.map