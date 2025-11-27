import { useCallback, useEffect, useState } from 'react';
import { registerForPushNotifications } from '../utils/pushNotifications';
import { SERVER_URL } from '../config';
import { PushSubscriptionStatusResponse } from '../types';

type SubscriptionState = PushSubscriptionStatusResponse['subscription'];

/**
 * Tracks and mutates the user's push notification subscription preferences.
 */
export function usePushSubscription(token: string | null) {
  const [subscription, setSubscription] = useState<SubscriptionState>(null);
  const [announcementEnabled, setAnnouncementEnabled] = useState(false);
  const [eventEnabled, setEventEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Clears all subscription state when unauthenticated.
   */
  const resetState = useCallback(() => {
    setSubscription(null);
    setAnnouncementEnabled(false);
    setEventEnabled(false);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadStatus = async () => {
      if (!token) {
        resetState();
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
          setSubscription(data.subscription);
          setAnnouncementEnabled(Boolean(data.subscription?.announcementAlertsEnabled));
          setEventEnabled(Boolean(data.subscription?.eventAlertsEnabled));
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
  }, [token, resetState]);

  /**
   * Persists preference changes, registering for push if no token exists.
   */
  const savePreferences = useCallback(
    async (prefs: { announcement?: boolean; event?: boolean }) => {
      if (!token) {
        throw new Error('You must be signed in to manage notifications.');
      }
      let pushToken = subscription?.token;
      if (!pushToken) {
        pushToken = await registerForPushNotifications();
      }
      const announcementValue =
        typeof prefs.announcement === 'boolean' ? prefs.announcement : announcementEnabled;
      const eventValue = typeof prefs.event === 'boolean' ? prefs.event : eventEnabled;
      const response = await fetch(`${SERVER_URL}/api/push-subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          token: pushToken,
          announcementAlertsEnabled: announcementValue,
          eventAlertsEnabled: eventValue,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${response.status})`);
      }
      const data = (await response.json()) as PushSubscriptionStatusResponse;
      setSubscription(data.subscription);
      setAnnouncementEnabled(Boolean(data.subscription?.announcementAlertsEnabled));
      setEventEnabled(Boolean(data.subscription?.eventAlertsEnabled));
    },
    [announcementEnabled, eventEnabled, subscription, token]
  );

  /**
   * Toggles announcement alerts, handling API state transitions.
   */
  const toggleAnnouncements = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await savePreferences({ announcement: !announcementEnabled });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [announcementEnabled, savePreferences, token]);

  /**
   * Toggles event alerts, handling API state transitions.
   */
  const toggleEventAlerts = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await savePreferences({ event: !eventEnabled });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [eventEnabled, savePreferences, token]);

  /**
   * Removes the push subscription entirely.
   */
  const disable = useCallback(async () => {
    if (!token) {
      resetState();
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
      resetState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [resetState, token]);

  return {
    announcementEnabled,
    eventEnabled,
    loading,
    error,
    setError,
    toggleAnnouncements,
    toggleEventAlerts,
    disable,
  };
}
