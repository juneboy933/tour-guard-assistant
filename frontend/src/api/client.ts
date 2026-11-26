export type ApiErrorCode = 'UNAUTHORIZED' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UNAVAILABLE' | 'REQUEST_FAILED';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function apiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  return (configuredUrl || window.location.origin).replace(/\/$/, '');
}

function errorForStatus(status: number): ApiError {
  if (status === 401) {
    return new ApiError(status, 'UNAUTHORIZED', 'Your secure session has expired. Please reopen your TourGuard link.');
  }
  if (status === 404) {
    return new ApiError(status, 'NOT_FOUND', 'The requested TourGuard information could not be found.');
  }
  if (status === 429) {
    return new ApiError(status, 'RATE_LIMITED', 'Too many requests. Please wait a moment and try again.');
  }
  if (status === 503) {
    return new ApiError(status, 'UNAVAILABLE', 'TourGuard is temporarily unavailable. Please try again shortly.');
  }
  return new ApiError(status, 'REQUEST_FAILED', 'We could not complete that request. Please try again.');
}

export function createApiClient(fetcher?: typeof fetch) {
  return {
    async request<T>(path: string, options: RequestInit = {}): Promise<T> {
      const headers = new Headers(options.headers);
      headers.set('Accept', 'application/json');
      if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      let response: Response;
      try {
        response = await (fetcher ?? globalThis.fetch)(`${apiBaseUrl()}/api/v1${path}`, {
          ...options,
          headers,
        });
      } catch {
        throw new ApiError(0, 'UNAVAILABLE', 'TourGuard is temporarily unavailable. Please try again shortly.');
      }

      if (!response.ok) {
        throw errorForStatus(response.status);
      }

      return response.json() as Promise<T>;
    },

    withTouristToken(accessToken: string) {
      return {
        request<T>(path: string, options: RequestInit = {}): Promise<T> {
          const headers = new Headers(options.headers);
          headers.set('Authorization', `Bearer ${accessToken}`);
          return this.requestWithHeaders<T>(path, { ...options, headers });
        },
        requestWithHeaders<T>(path: string, options: RequestInit = {}): Promise<T> {
          return createApiClient(fetcher).request<T>(path, options);
        },
      };
    },
  };
}

export const apiClient = createApiClient();
