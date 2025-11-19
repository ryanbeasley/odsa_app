import { useCallback, useEffect, useState } from 'react';
import { SERVER_URL } from '../config';
import { Event, EventCreateResponse, EventsResponse, RecurrenceRule } from '../types';

type EventPayload = {
  name: string;
  description: string;
  workingGroupId: number;
  startAt: string;
  endAt: string;
  location: string;
  recurrence?: RecurrenceRule;
  seriesEndAt?: string | null;
};

export function useEvents(token: string | null) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setEvents([]);
    setLoading(false);
    setSaving(false);
    setError(null);
  }, []);

  const fetchEvents = useCallback(async () => {
    if (!token) {
      resetState();
      return;
    }
    try {
      setError(null);
      setLoading(true);
      const response = await fetch(`${SERVER_URL}/api/events`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${response.status})`);
      }
      const data = (await response.json()) as EventsResponse;
      setEvents(data.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [resetState, token]);

  const createEvent = useCallback(
    async (payload: EventPayload) => {
      if (!token) {
        return;
      }
      try {
        setSaving(true);
        setError(null);
        const response = await fetch(`${SERVER_URL}/api/events`, {
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
        const data = (await response.json()) as EventCreateResponse;
        setEvents((prev) => [data.event, ...prev]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [token]
  );

  const updateEvent = useCallback(
    async (id: number, payload: EventPayload) => {
      if (!token) {
        return;
      }
      try {
        setSaving(true);
        setError(null);
        const response = await fetch(`${SERVER_URL}/api/events/${id}`, {
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
        const data = (await response.json()) as EventCreateResponse;
        setEvents((prev) => prev.map((evt) => (evt.id === id ? data.event : evt)));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [token]
  );

  const toggleAttendance = useCallback(
    async (eventId: number, options: { series: boolean; attending: boolean }) => {
      if (!token) {
        return;
      }
      const path = `${SERVER_URL}/api/events/${eventId}/attendees`;
      try {
        setSaving(true);
        setError(null);
        const response = await fetch(path, {
          method: options.attending ? 'DELETE' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ series: options.series }),
        });
        if (!response.ok && response.status !== 204) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error ?? `Request failed (${response.status})`);
       }
        setEvents((prev) => {
          const delta = options.attending ? -1 : 1;
          const updateOccurrences = (
            occurrences: Event['upcomingOccurrences'] | undefined,
            applyAll: boolean
          ) =>
            occurrences?.map((occ) => {
              const shouldApply = applyAll || occ.eventId === eventId;
              if (!shouldApply) return occ;
              const nextCount = Math.max(0, (occ.attendeeCount ?? 0) + delta);
              return {
                ...occ,
                attending: !options.attending,
                attendeeCount: nextCount,
              };
            });

          const targetSeries =
            prev.find((evt) => evt.id === eventId)?.seriesUuid ??
            prev.find((evt) => evt.upcomingOccurrences?.some((occ) => occ.eventId === eventId))?.seriesUuid ??
            null;
          return prev.map((evt) => {
            if (options.series && targetSeries && evt.seriesUuid === targetSeries) {
              const nextCount = Math.max(0, (evt.attendeeCount ?? 0) + delta);
              const nextOccs = updateOccurrences(evt.upcomingOccurrences, true);
              return {
                ...evt,
                attending: !options.attending,
                attendeeCount: nextCount,
                upcomingOccurrences: nextOccs,
              };
            }
            if (evt.id === eventId) {
              const nextCount = Math.max(0, (evt.attendeeCount ?? 0) + delta);
              const nextOccs = updateOccurrences(evt.upcomingOccurrences, false);
              return {
                ...evt,
                attending: !options.attending,
                attendeeCount: nextCount,
                upcomingOccurrences: nextOccs,
              };
            }
            if (evt.upcomingOccurrences?.some((occ) => occ.eventId === eventId)) {
              const nextOccs = updateOccurrences(evt.upcomingOccurrences, false);
              return {
                ...evt,
                upcomingOccurrences: nextOccs,
              };
            }
            return evt;
          });
        });
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
    fetchEvents();
  }, [fetchEvents, resetState, token]);

  return {
    events,
    loading,
    saving,
    error,
    setError,
    refresh: fetchEvents,
    createEvent,
    updateEvent,
    setEvents,
    toggleAttendance,
  };
}
