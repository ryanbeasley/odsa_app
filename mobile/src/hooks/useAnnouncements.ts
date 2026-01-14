import { useCallback, useEffect, useState } from 'react';
import { SERVER_URL } from '../config';
import {
  Announcement,
  AnnouncementCreateResponse,
  AnnouncementsResponse,
  TagsResponse,
} from '../types';

const PAGE_SIZE = 5;

type FetchOptions = {
  cursor?: number;
  append?: boolean;
};

/**
 * Fetches/paginates announcements and handles drafting/saving new ones.
 */
export function useAnnouncements(token: string | null) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [draft, setDraft] = useState('');
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  /**
   * Resets hook state when the user logs out or token changes.
   */
  const resetState = useCallback(() => {
    setAnnouncements([]);
    setDraft('');
    setDraftTags([]);
    setNextCursor(null);
    setError(null);
    setLoading(false);
    setSaving(false);
    setLoadingMore(false);
    setTagSuggestions([]);
  }, []);

  /**
   * Retrieves a page of announcements from the API, optionally appending.
   */
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
      const queryString = params.toString() ? `?${params.toString()}` : '';

      const response = await fetch(
        `${SERVER_URL}/api/announcements${queryString}`,
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

  /**
   * Loads the first page of announcements after authentication.
   */
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

  /**
   * Fetches the next page, guarding against concurrent requests.
   */
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

  /**
   * Sends a new announcement to the API and prepends it locally.
   */
  const saveAnnouncement = useCallback(async () => {
    if (!token || !draft.trim()) {
      return;
    }
    try {
      setSaving(true);
      setError(null);
      // Helpful for debugging submission failures in Metro logs
      console.log('[useAnnouncements] submitting announcement', {
        hasToken: Boolean(token),
        bodyLength: draft.trim().length,
      });
      const response = await fetch(`${SERVER_URL}/api/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: draft.trim(), tags: draftTags }),
      });

      console.log('[useAnnouncements] announcement response', response.status);
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const data = (await response.json()) as AnnouncementCreateResponse;
      setAnnouncements((prev) => [data.announcement, ...prev]);
      setDraft('');
      setDraftTags([]);
      console.log('[useAnnouncements] announcement saved', data.announcement.id);
    } catch (err) {
      console.error('[useAnnouncements] failed to save announcement', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [draft, draftTags, token]);

  /**
   * Loads tag suggestions for autocomplete.
   */
  const loadTagSuggestions = useCallback(async () => {
    if (!token) {
      return;
    }
    const response = await fetch(`${SERVER_URL}/api/tags`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    const data = (await response.json()) as TagsResponse;
    setTagSuggestions(data.tags);
  }, [token]);

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
    draftTags,
    setDraftTags,
    tagSuggestions,
    loadTagSuggestions,
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
