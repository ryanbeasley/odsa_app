import { useCallback, useEffect, useState } from 'react';
import { SERVER_URL } from '../config';
import {
  Announcement,
  AnnouncementCreateResponse,
  AnnouncementsResponse,
} from '../types';

const PAGE_SIZE = 5;

type FetchOptions = {
  cursor?: number;
  append?: boolean;
};

export function useAnnouncements(token: string | null) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);

  const resetState = useCallback(() => {
    setAnnouncements([]);
    setDraft('');
    setNextCursor(null);
    setError(null);
    setLoading(false);
    setSaving(false);
    setLoadingMore(false);
  }, []);

  const fetchAnnouncements = useCallback(
    async ({ cursor, append }: FetchOptions = {}) => {
      if (!token) {
        return;
      }

      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      if (cursor) {
        params.set('cursor', String(cursor));
      }
      const queryString = params.toString();

      const response = await fetch(
        `${SERVER_URL}/api/announcements${queryString ? `?${queryString}` : ''}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const data = (await response.json()) as AnnouncementsResponse;

      setAnnouncements((prev) =>
        append ? [...prev, ...data.announcements] : data.announcements
      );
      setNextCursor(data.nextCursor);
    },
    [token]
  );

  const loadInitial = useCallback(async () => {
    if (!token) {
      resetState();
      return;
    }

    try {
      setError(null);
      await fetchAnnouncements();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [fetchAnnouncements, resetState, token]);

  const loadMoreAnnouncements = useCallback(async () => {
    if (!token || !nextCursor || loadingMore) {
      return;
    }
    try {
      setLoadingMore(true);
      setError(null);
      await fetchAnnouncements({ cursor: nextCursor, append: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoadingMore(false);
    }
  }, [fetchAnnouncements, loadingMore, nextCursor, token]);

  const saveAnnouncement = useCallback(async () => {
    if (!token || !draft.trim()) {
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const response = await fetch(`${SERVER_URL}/api/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: draft.trim() }),
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const data = (await response.json()) as AnnouncementCreateResponse;
      setAnnouncements((prev) => [data.announcement, ...prev]);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [draft, token]);

  useEffect(() => {
    if (!token) {
      resetState();
      return;
    }
    setLoading(true);
    loadInitial();
  }, [loadInitial, resetState, token]);

  return {
    announcements,
    draft,
    setDraft,
    loading,
    saving,
    loadingMore,
    hasMore: Boolean(nextCursor),
    error,
    setError,
    saveAnnouncement,
    loadMoreAnnouncements,
  };
}
