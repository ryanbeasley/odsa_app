import { randomUUID } from 'crypto';
import { db } from '../db/connection';
import { EventAttendeeRow, EventRow } from '../types';

/**
 * Returns all events ordered by start time and creation date.
 */
export function listEvents(): (EventRow & { working_group_name?: string })[] {
  return db
    .prepare<[], EventRow & { working_group_name?: string }>(
      `SELECT e.*, wg.name as working_group_name
       FROM events e
       LEFT JOIN working_groups wg ON wg.id = e.working_group_id
       ORDER BY e.start_at DESC, e.created_at DESC`
    )
    .all();
}

/**
 * Returns events whose end time is in the future relative to nowIso.
 */
export function listUpcomingEvents(nowIso: string): (EventRow & { working_group_name?: string })[] {
  return db
    .prepare<[string], EventRow & { working_group_name?: string }>(
      `SELECT e.*, wg.name as working_group_name
       FROM events e
       LEFT JOIN working_groups wg ON wg.id = e.working_group_id
       WHERE e.end_at >= ?
       ORDER BY e.start_at ASC, e.created_at ASC`
    )
    .all(nowIso);
}

/**
 * Counts attendees for the provided event IDs.
 */
export function countAttendeesByEventIds(eventIds: number[]): Record<number, number> {
  if (!eventIds.length) {
    return {};
  }
  const placeholders = eventIds.map(() => '?').join(',');
  const stmt = db.prepare(
    `SELECT event_id, COUNT(*) as count FROM event_attendees WHERE event_id IN (${placeholders}) GROUP BY event_id`
  );
  const rows = stmt.all(...eventIds) as Array<{ event_id: number; count: number }>;
  return rows.reduce<Record<number, number>>((acc, row) => {
    acc[row.event_id] = row.count;
    return acc;
  }, {});
}

/**
 * Creates a single event row and returns it with all columns.
 */
export function createEvent(
  name: string,
  description: string,
  workingGroupId: number,
  startAt: string,
  endAt: string,
  location: string,
  locationDisplayName: string | null,
  seriesUuid: string | null,
  recurrence: string | null,
  seriesEndAt: string | null
): EventRow {
  const insert = db
    .prepare<[string, string, number, string, string, string, string | null, string | null, string | null, string | null]>(
      'INSERT INTO events (name, description, working_group_id, start_at, end_at, location, location_display_name, series_uuid, recurrence, series_end_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(name, description, workingGroupId, startAt, endAt, location, locationDisplayName, seriesUuid, recurrence, seriesEndAt);

  return db
    .prepare<[number], EventRow>('SELECT * FROM events WHERE id = ?')
    .get(Number(insert.lastInsertRowid)) as EventRow;
}

/**
 * Creates a series of related events sharing a generated series UUID.
 */
export function createEventSeries(
  payloads: {
    name: string;
    description: string;
    workingGroupId: number;
    startAt: string;
    endAt: string;
    location: string;
    locationDisplayName: string | null;
    recurrence: string | null;
    seriesEndAt: string | null;
  }[]
): EventRow[] {
  const seriesUuid = randomUUID();
  return payloads.map((payload) =>
    createEvent(
      payload.name,
      payload.description,
      payload.workingGroupId,
      payload.startAt,
      payload.endAt,
      payload.location,
      payload.locationDisplayName,
      seriesUuid,
      payload.recurrence,
      payload.seriesEndAt
    )
  );
}

/**
 * Finds an event by ID including the working group name.
 */
export function findEventById(id: number): (EventRow & { working_group_name?: string }) | undefined {
  return db
    .prepare<[number], EventRow & { working_group_name?: string }>(
      `SELECT e.*, wg.name as working_group_name
       FROM events e
       LEFT JOIN working_groups wg ON wg.id = e.working_group_id
       WHERE e.id = ?`
    )
    .get(id);
}

/**
 * Updates an event's core fields and returns the hydrated record.
 */
export function updateEvent(
  id: number,
  name: string,
  description: string,
  workingGroupId: number,
  startAt: string,
  endAt: string,
  location: string,
  locationDisplayName: string | null
): (EventRow & { working_group_name?: string }) | undefined {
  db.prepare<[string, string, number, string, string, string, string | null, number]>(
    'UPDATE events SET name = ?, description = ?, working_group_id = ?, start_at = ?, end_at = ?, location = ?, location_display_name = ? WHERE id = ?'
  ).run(name, description, workingGroupId, startAt, endAt, location, locationDisplayName, id);

  return findEventById(id);
}

/**
 * Deletes all events belonging to a given series UUID.
 */
export function deleteEventsBySeries(seriesUuid: string): void {
  db.prepare<[string]>('DELETE FROM events WHERE series_uuid = ?').run(seriesUuid);
}

/**
 * Deletes a single event by ID.
 */
export function deleteEventById(id: number): void {
  db.prepare<[number]>('DELETE FROM events WHERE id = ?').run(id);
}

/**
 * Lists events that belong to a given series.
 */
export function listEventsBySeries(seriesUuid: string): EventRow[] {
  return db
    .prepare<[string], EventRow>('SELECT * FROM events WHERE series_uuid = ? ORDER BY start_at ASC')
    .all(seriesUuid);
}

/**
 * Deletes all events associated with a working group.
 */
export function deleteEventsByWorkingGroup(workingGroupId: number): void {
  db.prepare<[number]>('DELETE FROM events WHERE working_group_id = ?').run(workingGroupId);
}

/**
 * Registers a user as attending an event, ignoring duplicates.
 */
export function addEventAttendee(userId: number, eventId: number): EventAttendeeRow {
  db.prepare<[number, number]>('INSERT OR IGNORE INTO event_attendees (user_id, event_id) VALUES (?, ?)').run(
    userId,
    eventId
  );
  return db
    .prepare<[number, number], EventAttendeeRow>('SELECT * FROM event_attendees WHERE user_id = ? AND event_id = ?')
    .get(userId, eventId) as EventAttendeeRow;
}

/**
 * Removes a user from an event's attendee list.
 */
export function deleteEventAttendee(userId: number, eventId: number): void {
  db.prepare<[number, number]>('DELETE FROM event_attendees WHERE user_id = ? AND event_id = ?').run(userId, eventId);
}

/**
 * Returns all event IDs the user is attending.
 */
export function listUserEventIds(userId: number): number[] {
  return db
    .prepare<[number], { event_id: number }>('SELECT event_id FROM event_attendees WHERE user_id = ?')
    .all(userId)
    .map((row) => row.event_id);
}
