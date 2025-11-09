import { useCallback, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import { useAuthRequest, makeRedirectUri } from 'expo-auth-session';
import { SERVER_URL } from '../config';
import { AuthResponse, Role, User } from '../types';

type AuthMode = 'login' | 'signup';

type Credentials = {
  email: string;
  password: string;
};

type StartAsyncFn = (options: { authUrl: string; returnUrl?: string }) => Promise<{
  type: 'success' | 'dismiss' | 'cancel' | 'error';
  params?: Record<string, string>;
}>;

export function useAuth() {
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [viewAsMember, setViewAsMember] = useState(false);

  async function authenticate(mode: AuthMode, credentials: Credentials) {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const response = await fetch(`${SERVER_URL}/api/${mode === 'signup' ? 'signup' : 'login'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: credentials.email.trim().toLowerCase(),
          password: credentials.password,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Authentication failed');
      }

      const data = (await response.json()) as AuthResponse;
      setToken(data.token);
      setSessionUser(data.user);
      setViewAsMember(false);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setAuthLoading(false);
    }
  }

  const logout = () => {
    setSessionUser(null);
    setToken(null);
    setViewAsMember(false);
  };

  const toggleAdminMode = useCallback(() => {
    setViewAsMember((prev) => {
      if (!sessionUser || sessionUser.role !== 'admin') {
        return false;
      }
      return !prev;
    });
  }, [sessionUser]);

  const googleSignIn = useCallback(async () => {
    if (!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID) {
      setAuthError('Google Sign-In not configured.');
      return;
    }

    setGoogleLoading(true);
    setAuthError(null);
    try {
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'odsamobile',
      });

      const discovery = {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
      };

      const startAsync = (AuthSession as unknown as { startAsync?: StartAsyncFn }).startAsync;
      if (!startAsync) {
        throw new Error('AuthSession.startAsync is not available in this environment.');
      }

      const authResult = await startAsync({
        authUrl: `${discovery.authorizationEndpoint}?response_type=id_token&client_id=${process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&scope=openid%20email%20profile&nonce=${Date.now()}`,
      });

      if (authResult.type !== 'success' || !authResult.params?.id_token) {
        throw new Error('Google authentication cancelled');
      }

      const response = await fetch(`${SERVER_URL}/api/oauth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: authResult.params.id_token }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Failed to sign in with Google');
      }

      const data = (await response.json()) as AuthResponse;
      setToken(data.token);
      setSessionUser(data.user);
      setViewAsMember(false);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed');
      throw err;
    } finally {
      setGoogleLoading(false);
    }
  }, []);

  const effectiveUser: User | null = sessionUser
    ? viewAsMember && sessionUser.role === 'admin'
      ? { ...sessionUser, role: 'user' as Role }
      : sessionUser
    : null;
  const isSessionAdmin = sessionUser?.role === 'admin';
  const isViewingAsAdmin = effectiveUser?.role === 'admin';

  return {
    user: effectiveUser,
    sessionUser,
    isSessionAdmin: Boolean(isSessionAdmin),
    isViewingAsAdmin: Boolean(isViewingAsAdmin),
    token,
    authLoading,
    authError,
    googleLoading,
    authenticate,
    googleSignIn,
    logout,
    toggleAdminMode,
    setAuthError,
  };
}
