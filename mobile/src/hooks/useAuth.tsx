import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
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
  eventAlertsSmsEnabled?: boolean;
};

type AuthContextValue = {
  user: User | null;
  sessionUser: User | null;
  token: string | null;
  authLoading: boolean;
  authHydrating: boolean;
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
const AUTH_TOKEN_KEY = 'odsa.auth.token';
const AUTH_USER_KEY = 'odsa.auth.user';

/**
 * Provides authentication state/actions to the component tree.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authHydrating, setAuthHydrating] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [viewAsMember, setViewAsMember] = useState(false);

  const readStoredSession = async () => {
    const available = await SecureStore.isAvailableAsync();
    if (available) {
      const [storedToken, storedUser] = await Promise.all([
        SecureStore.getItemAsync(AUTH_TOKEN_KEY),
        SecureStore.getItemAsync(AUTH_USER_KEY),
      ]);
      return { storedToken, storedUser };
    }
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return {
        storedToken: localStorage.getItem(AUTH_TOKEN_KEY),
        storedUser: localStorage.getItem(AUTH_USER_KEY),
      };
    }
    return { storedToken: null, storedUser: null };
  };

  const writeStoredSession = async (nextToken: string, nextUser: User) => {
    const payload = JSON.stringify(nextUser);
    const available = await SecureStore.isAvailableAsync();
    if (available) {
      await Promise.all([
        SecureStore.setItemAsync(AUTH_TOKEN_KEY, nextToken),
        SecureStore.setItemAsync(AUTH_USER_KEY, payload),
      ]);
      return;
    }
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTH_TOKEN_KEY, nextToken);
      localStorage.setItem(AUTH_USER_KEY, payload);
    }
  };

  const clearStoredSession = async () => {
    const available = await SecureStore.isAvailableAsync();
    if (available) {
      await Promise.all([
        SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
        SecureStore.deleteItemAsync(AUTH_USER_KEY),
      ]);
      return;
    }
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    }
  };

  useEffect(() => {
    const hydrate = async () => {
      try {
        const { storedToken, storedUser } = await readStoredSession();
        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser) as User;
          setToken(storedToken);
          setSessionUser({
            ...parsedUser,
            eventAlertsSmsEnabled: Boolean(parsedUser.eventAlertsSmsEnabled),
          });
        }
      } catch {
        // ignore storage errors and force login
      } finally {
        setAuthHydrating(false);
      }
    };
    void hydrate();
  }, []);

  const persistSession = async (nextToken: string, nextUser: User) => {
    try {
      await writeStoredSession(nextToken, nextUser);
    } catch {
      // ignore storage errors
    }
  };

  const clearSession = async () => {
    try {
      await clearStoredSession();
    } catch {
      // ignore storage errors
    }
  };

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
      void persistSession(data.token, data.user);
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
    void clearSession();
  };

  /**
   * Allows admins to toggle between admin/member view modes.
   */
  const toggleAdminMode = () => {
    setViewAsMember((prev) => {
      if (sessionUser?.role !== 'admin') {
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
      void persistSession(data.token, data.user);
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
        eventAlertsSmsEnabled: payload.eventAlertsSmsEnabled ?? undefined,
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
    void persistSession(data.token, data.user);
  };

  const effectiveUser: User | null = (() => {
    if (!sessionUser) {
      return null;
    }
    if (viewAsMember && sessionUser.role === 'admin') {
      return { ...sessionUser, role: 'user' as Role };
    }
    return sessionUser;
  })();

  const value = useMemo<AuthContextValue>(
    () => ({
      user: effectiveUser,
      sessionUser,
      token,
      authLoading,
      authHydrating,
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
      authHydrating,
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
