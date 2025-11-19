import { useCallback, useEffect, useState } from 'react';
import { registerForPushNotifications } from '../utils/pushNotifications';
import { SERVER_URL } from '../config';
import { PushSubscriptionStatusResponse } from '../types';

export function usePushSubscription(token: string | null) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadStatus = async () => {
      if (!token) {
        setEnabled(false);
        setError(null);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${SERVER_URL}/api/push-subscriptions`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error ?? `Request failed (${response.status})`);
        }

        const data = (await response.json()) as PushSubscriptionStatusResponse;
        if (!cancelled) {
          setEnabled(Boolean(data.subscription));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const enable = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const expoToken = await registerForPushNotifications();
      const response = await fetch(`${SERVER_URL}/api/push-subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token: expoToken }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${response.status})`);
      }
      setEnabled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setEnabled(false);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const disable = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${SERVER_URL}/api/push-subscriptions`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok && response.status !== 204) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${response.status})`);
      }
      setEnabled(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  return {
    enabled,
    loading,
    error,
    setEnabled,
    setError,
    enable,
    disable,
  };
}
