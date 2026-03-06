/**
 * HTTP client for the nullcheck API.
 * Handles authentication, error mapping, and timeouts.
 */

import type { ApiResponse } from './types.js';

const DEFAULT_BASE_URL = 'https://api.nullcheck.io';
const REQUEST_TIMEOUT_MS = 30_000;

export class NullcheckClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || DEFAULT_BASE_URL;
  }

  async get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return this.request<T>(url.toString(), { method: 'GET' });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(new URL(path, this.baseUrl).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
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

      const json = (await response.json()) as ApiResponse<T>;

      if (!response.ok || !json.success) {
        const code = json.error?.code || `HTTP_${response.status}`;
        const message = json.error?.message || response.statusText;
        throw new NullcheckApiError(code, message, response.status);
      }

      return json.data as T;
    } catch (error) {
      if (error instanceof NullcheckApiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new NullcheckApiError('TIMEOUT', `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`, 408);
      }
      throw new NullcheckApiError(
        'NETWORK_ERROR',
        `Failed to reach nullcheck API: ${error instanceof Error ? error.message : String(error)}`,
        0
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class NullcheckApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'NullcheckApiError';
  }

  toToolResult(): { content: Array<{ type: 'text'; text: string }>; isError: true } {
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
