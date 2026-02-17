/**
 * Structured API errors for better agent error handling
 */

export type ApiErrorCode =
  | 'RATE_LIMIT_EXCEEDED'
  | 'AUTHENTICATION_FAILED'
  | 'SERVICE_UNAVAILABLE'
  | 'REQUEST_FAILED'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR';

export class ApiError extends Error {
  constructor(
    message: string,
    public service: string,
    public code: ApiErrorCode,
    public statusCode?: number,
    public retryAfter?: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * Whether this error is retryable
   */
  get isRetryable(): boolean {
    return (
      this.code === 'RATE_LIMIT_EXCEEDED' ||
      this.code === 'SERVICE_UNAVAILABLE' ||
      this.code === 'TIMEOUT'
    );
  }

  /**
   * Suggested retry delay in seconds
   */
  get suggestedRetryDelay(): number {
    if (this.retryAfter) return this.retryAfter;
    if (this.code === 'RATE_LIMIT_EXCEEDED') return 60;
    if (this.code === 'SERVICE_UNAVAILABLE') return 30;
    if (this.code === 'TIMEOUT') return 5;
    return 0;
  }

  toJSON() {
    return {
      error: this.message,
      service: this.service,
      code: this.code,
      statusCode: this.statusCode,
      retryAfter: this.retryAfter,
      isRetryable: this.isRetryable,
      details: this.details,
    };
  }
}

/**
 * Create appropriate ApiError from HTTP response
 */
export function createApiErrorFromResponse(
  service: string,
  response: Response,
  customMessage?: string
): ApiError {
  const message = customMessage || `${service} API request failed`;

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('retry-after') || '60');
    return new ApiError(
      'Rate limit exceeded',
      service,
      'RATE_LIMIT_EXCEEDED',
      429,
      retryAfter
    );
  }

  if (response.status === 401 || response.status === 403) {
    return new ApiError(
      'API authentication failed or quota exceeded',
      service,
      'AUTHENTICATION_FAILED',
      response.status
    );
  }

  if (response.status === 404) {
    return new ApiError(
      'Resource not found',
      service,
      'NOT_FOUND',
      404
    );
  }

  if (response.status >= 500) {
    return new ApiError(
      'Service temporarily unavailable',
      service,
      'SERVICE_UNAVAILABLE',
      response.status
    );
  }

  return new ApiError(
    message,
    service,
    'REQUEST_FAILED',
    response.status
  );
}

/**
 * Create timeout error
 */
export function createTimeoutError(service: string, timeoutMs: number): ApiError {
  return new ApiError(
    `Request timed out after ${timeoutMs}ms`,
    service,
    'TIMEOUT',
    undefined,
    5, // Suggest retry after 5 seconds
    { timeoutMs }
  );
}

/**
 * Wrap a fetch call with timeout and error handling
 */
export async function fetchWithTimeout<T>(
  url: string,
  service: string,
  options: RequestInit = {},
  timeoutMs: number = 10000
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw createApiErrorFromResponse(service, response);
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw createTimeoutError(service, timeoutMs);
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'Unknown error',
      service,
      'REQUEST_FAILED'
    );
  } finally {
    clearTimeout(timeout);
  }
}
