import { ApiError } from '@/types/api';

/**
 * Centralized API client connecting to the NestJS backend.
 *
 * Reads base URL from process.env.NEXT_PUBLIC_API_BASE_URL.
 * All requests enforce typed payloads and consistent error parsing.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api/v1';

interface RequestOptions extends RequestInit {
  apiKey?: string;
  idempotencyKey?: string;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { apiKey, idempotencyKey, headers = {}, ...rest } = options;

  const url = `${API_BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(headers as Record<string, string>),
  };

  if (apiKey) {
    requestHeaders['Authorization'] = `Bearer ${apiKey}`;
  }

  if (idempotencyKey) {
    requestHeaders['Idempotency-Key'] = idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: requestHeaders,
    });
  } catch (networkError) {
    throw new ApiError(
      networkError instanceof Error
        ? `Network connection failed: ${networkError.message}`
        : 'Network connection failed',
      0,
    );
  }

  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }

    let errorMessage = `Request failed with status ${response.status}`;
    if (typeof errorData === 'object' && errorData !== null) {
      const errObj = errorData as { message?: string | string[]; error?: string };
      if (Array.isArray(errObj.message)) {
        errorMessage = errObj.message.join(', ');
      } else if (typeof errObj.message === 'string') {
        errorMessage = errObj.message;
      } else if (typeof errObj.error === 'string') {
        errorMessage = errObj.error;
      }
    }

    throw new ApiError(errorMessage, response.status, errorData);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

/**
 * Convenience methods for HTTP verbs
 */
export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'DELETE' }),
};
