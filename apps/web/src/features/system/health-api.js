import { apiRequest } from '../../lib/api-client.js';

/**
 * Returns { status, database }.
 * A 503 still carries a valid body (API up, database down), so it is data, not a failure.
 */
export async function fetchHealth({ signal } = {}) {
  try {
    return await apiRequest('/health', { signal, auth: false });
  } catch (error) {
    if (error.status === 503 && error.payload?.data) return error.payload.data;
    throw error;
  }
}
