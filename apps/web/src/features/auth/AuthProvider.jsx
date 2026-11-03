import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, onSignedOut, refreshSession, setAccessToken } from '../../lib/api-client.js';

const AuthContext = createContext(null);
const CHANNEL = 'tigmi-auth';

/**
 * Session state for the whole app.
 *  status: 'loading' (restoring the session on page load) | 'authenticated' | 'anonymous'
 * Signing out in one tab signs out every other tab (BroadcastChannel).
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState({ status: 'loading', user: null });

  const becomeAnonymous = useCallback(() => {
    setAccessToken(null);
    queryClient.clear(); // never show the previous user's cached data
    setState({ status: 'anonymous', user: null });
  }, [queryClient]);

  // Restore the session from the HttpOnly refresh cookie on page load.
  useEffect(() => {
    let active = true;
    refreshSession()
      .then((user) => {
        if (active)
          setState(user ? { status: 'authenticated', user } : { status: 'anonymous', user: null });
      })
      .catch(() => {
        if (active) setState({ status: 'anonymous', user: null });
      });
    return () => {
      active = false;
    };
  }, []);

  // React to sessions ending elsewhere: expired refresh, revoked session, or another tab.
  useEffect(() => {
    const unsubscribe = onSignedOut(becomeAnonymous);
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
    if (channel) {
      channel.onmessage = (event) => {
        if (event.data === 'signed-out') becomeAnonymous();
      };
    }
    return () => {
      unsubscribe();
      channel?.close();
    };
  }, [becomeAnonymous]);

  const signIn = useCallback(async ({ email, password }) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    setAccessToken(data.accessToken);
    setState({ status: 'authenticated', user: data.user });
    return data.user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // The session may already be gone server-side; signing out locally is what matters.
    } finally {
      becomeAnonymous();
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel(CHANNEL);
        channel.postMessage('signed-out');
        channel.close();
      }
    }
  }, [becomeAnonymous]);

  const value = useMemo(() => ({ ...state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
