import { apiRequest } from '../../lib/api-client.js';

const post = (path, body) => apiRequest(path, { method: 'POST', body, auth: false });

export const register = (data) => post('/auth/register', data);
export const verifyEmail = (token) => post('/auth/verify-email', { token });
export const resendVerification = (email) => post('/auth/resend-verification', { email });
export const forgotPassword = (email) => post('/auth/forgot-password', { email });
export const resetPassword = (token, password) => post('/auth/reset-password', { token, password });
