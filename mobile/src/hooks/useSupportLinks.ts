import { useCallback, useEffect, useState } from 'react';
import { SERVER_URL } from '../config';
import {
  SupportLink,
  SupportLinkMutationResponse,
  SupportLinksResponse,
} from '../types';

type SupportLinkPayload = {
  title: string;
  description: string;
  link: string;
};

/**
 * Fetches and manages support links shown on the support screen.
 */
export function useSupportLinks(token: string | null) {
  const [links, setLinks] = useState<SupportLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Clears all hook state when the user logs out.
   */
  const resetState = useCallback(() => {
    setLinks([]);
    setLoading(false);
    setSaving(false);
    setRemovingId(null);
    setError(null);
  }, []);

  /**
   * Loads the current set of support links.
   */
  const fetchLinks = useCallback(async () => {
    if (!token) {
      resetState();
      return;
    }
    try {
      setError(null);
      setLoading(true);
      const response = await fetch(`${SERVER_URL}/api/support-links`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${response.status})`);
      }
      const data = (await response.json()) as SupportLinksResponse;
      setLinks(data.links);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [resetState, token]);

  /**
   * Creates a new support link.
   */
  const createLink = useCallback(
    async (payload: SupportLinkPayload) => {
      if (!token) {
        return;
      }
      try {
        setSaving(true);
        setError(null);
        const response = await fetch(`${SERVER_URL}/api/support-links`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error ?? `Request failed (${response.status})`);
        }
        const data = (await response.json()) as SupportLinkMutationResponse;
        setLinks((prev) => [...prev, data.link]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [token]
  );

  /**
   * Updates an existing support link by ID.
   */
  const updateLink = useCallback(
    async (id: number, payload: SupportLinkPayload) => {
      if (!token) {
        return;
      }
      try {
        setSaving(true);
        setError(null);
        const response = await fetch(`${SERVER_URL}/api/support-links/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error ?? `Request failed (${response.status})`);
        }
        const data = (await response.json()) as SupportLinkMutationResponse;
        setLinks((prev) => prev.map((link) => (link.id === id ? data.link : link)));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [token]
  );

  /**
   * Deletes a support link by ID.
   */
  const deleteLink = useCallback(
    async (id: number) => {
      if (!token) {
        return;
      }
      try {
        setRemovingId(id);
        setError(null);
        const response = await fetch(`${SERVER_URL}/api/support-links/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok && response.status !== 204) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error ?? `Request failed (${response.status})`);
        }
        setLinks((prev) => prev.filter((link) => link.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setRemovingId(null);
      }
    },
    [token]
  );

  /**
   * Applies a new ordering based on the provided IDs.
   */
  const reorderLinks = useCallback(
    async (ids: number[]) => {
      if (!token) {
        return;
      }
      try {
        setReordering(true);
        setError(null);
        const response = await fetch(`${SERVER_URL}/api/support-links/reorder`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ids }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error ?? `Request failed (${response.status})`);
        }
        const data = (await response.json()) as SupportLinksResponse;
        setLinks(data.links);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setReordering(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) {
      resetState();
      return;
    }
    fetchLinks();
  }, [fetchLinks, resetState, token]);

  return {
    links,
    loading,
    saving,
    removingId,
    reordering,
    error,
    setError,
    refresh: fetchLinks,
    createLink,
    updateLink,
    deleteLink,
    reorderLinks,
  };
}
