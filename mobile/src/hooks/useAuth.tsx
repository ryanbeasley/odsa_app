import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
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

type ProfilePayload = {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string;
};

type AuthContextValue = {
  user: User | null;
  sessionUser: User | null;
  token: string | null;
  authLoading: boolean;
  googleLoading: boolean;
  authError: string | null;
  isSessionAdmin: boolean;
  isViewingAsAdmin: boolean;
  authenticate: (mode: AuthMode, credentials: Credentials) => Promise<void>;
  logout: () => void;
  toggleAdminMode: () => void;
  googleSignIn: () => Promise<void>;
  updateProfile: (payload: ProfilePayload) => Promise<void>;
  setAuthError: (value: string | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Provides authentication state/actions to the component tree.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [viewAsMember, setViewAsMember] = useState(false);

  /**
   * Logs in or signs up the user with email/password credentials.
   */
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

  /**
   * Clears all auth state, effectively signing the user out.
   */
  const logout = () => {
    setSessionUser(null);
    setToken(null);
    setViewAsMember(false);
  };

  /**
   * Allows admins to toggle between admin/member view modes.
   */
  const toggleAdminMode = () => {
    setViewAsMember((prev) => {
      if (!sessionUser || sessionUser.role !== 'admin') {
        return false;
      }
      return !prev;
    });
  };

  /**
   * Initiates the Google OAuth flow and saves the resulting session.
   * Not functional, yet.
   */
  const googleSignIn = async () => {
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
  };

  /**
   * Updates the current user's profile information.
   */
  const updateProfile = async (payload: ProfilePayload) => {
    if (!token) {
      throw new Error('You must be signed in to update your profile.');
    }
    const response = await fetch(`${SERVER_URL}/api/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        firstName: payload.firstName ?? undefined,
        lastName: payload.lastName ?? undefined,
        phone: payload.phone ?? undefined,
        email: payload.email ?? undefined,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error ?? 'Failed to update profile');
    }
    const data = (await response.json()) as AuthResponse;
    setToken(data.token);
    setSessionUser(data.user);
    setViewAsMember(false);
  };

  const effectiveUser: User | null = sessionUser
    ? viewAsMember && sessionUser.role === 'admin'
      ? { ...sessionUser, role: 'user' as Role }
      : sessionUser
    : null;

  const value = useMemo<AuthContextValue>(
    () => ({
      user: effectiveUser,
      sessionUser,
      token,
      authLoading,
      googleLoading,
      authError,
      isSessionAdmin: Boolean(sessionUser?.role === 'admin'),
      isViewingAsAdmin: Boolean(effectiveUser?.role === 'admin'),
      authenticate,
      logout,
      toggleAdminMode,
      googleSignIn,
      updateProfile,
      setAuthError,
    }),
    [
      effectiveUser,
      sessionUser,
      token,
      authLoading,
      googleLoading,
      authError,
      authenticate,
      logout,
      toggleAdminMode,
      googleSignIn,
      updateProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Convenience hook to consume the auth context.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
