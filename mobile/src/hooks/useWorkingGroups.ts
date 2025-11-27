import { useCallback, useEffect, useState } from 'react';
import { SERVER_URL } from '../config';
import { WorkingGroup, WorkingGroupCreateResponse, WorkingGroupsResponse } from '../types';

type WorkingGroupPayload = {
  name: string;
  description: string;
  members: string;
};

/**
 * Handles loading and mutating working groups through the API.
 */
export function useWorkingGroups(token: string | null) {
  const [groups, setGroups] = useState<WorkingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Clears working group state when unauthenticated.
   */
  const resetState = useCallback(() => {
    setGroups([]);
    setLoading(false);
    setSaving(false);
    setError(null);
  }, []);

  /**
   * Fetches the current list of working groups.
   */
  const fetchGroups = useCallback(async () => {
    if (!token) {
      resetState();
      return;
    }
    try {
      setError(null);
      setLoading(true);
      const response = await fetch(`${SERVER_URL}/api/working-groups`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${response.status})`);
      }
      const data = (await response.json()) as WorkingGroupsResponse;
      setGroups(data.groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [resetState, token]);

  /**
   * Creates a new working group and prepends it.
   */
  const createGroup = useCallback(
    async (payload: WorkingGroupPayload) => {
      if (!token) {
        return;
      }
      try {
        setSaving(true);
        setError(null);
        const response = await fetch(`${SERVER_URL}/api/working-groups`, {
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
        const data = (await response.json()) as WorkingGroupCreateResponse;
        setGroups((prev) => [data.group, ...prev]);
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
   * Updates a working group in place.
   */
  const updateGroup = useCallback(
    async (id: number, payload: WorkingGroupPayload) => {
      if (!token) {
        return;
      }
      try {
        setSaving(true);
        setError(null);
        const response = await fetch(`${SERVER_URL}/api/working-groups/${id}`, {
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
        const data = (await response.json()) as WorkingGroupCreateResponse;
        setGroups((prev) => prev.map((g) => (g.id === id ? data.group : g)));
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
   * Deletes a working group by ID.
   */
  const deleteGroup = useCallback(
    async (id: number) => {
      if (!token) {
        return;
      }
      try {
        setSaving(true);
        setError(null);
        const response = await fetch(`${SERVER_URL}/api/working-groups/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok && response.status !== 204) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error ?? `Request failed (${response.status})`);
        }
        setGroups((prev) => prev.filter((group) => group.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) {
      resetState();
      return;
    }
    fetchGroups();
  }, [fetchGroups, resetState, token]);

  return {
    groups,
    loading,
    saving,
    error,
    setError,
    refresh: fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
  };
}
