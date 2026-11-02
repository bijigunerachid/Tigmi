const API_BASE = '/api/v1';

/** Error carrying the API's machine-readable `code`, used later for translated messages. */
export class ApiError extends Error {
  constructor({ status, code, message, requestId, payload }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.payload = payload;
  }
}

/**
 * Calls the Tigmi API and returns the `data` field of a successful response.
 * Throws ApiError for network failures (status 0) and non-2xx responses.
 */
export async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Network request failed' });
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: payload?.error?.code ?? 'HTTP_ERROR',
      message: payload?.error?.message ?? `Request failed with status ${response.status}`,
      requestId: payload?.error?.requestId,
      payload,
    });
  }

  return payload?.data;
}
