import { randomUUID } from 'crypto';
import { db } from '../db/connection';
import { EventAttendeeRow, EventRow } from '../types';

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

export function createEvent(
  name: string,
  description: string,
  workingGroupId: number,
  startAt: string,
  endAt: string,
  location: string,
  seriesUuid: string | null,
  recurrence: string | null,
  seriesEndAt: string | null
): EventRow {
  const insert = db
    .prepare<[string, string, number, string, string, string, string | null, string | null, string | null]>(
      'INSERT INTO events (name, description, working_group_id, start_at, end_at, location, series_uuid, recurrence, series_end_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(name, description, workingGroupId, startAt, endAt, location, seriesUuid, recurrence, seriesEndAt);

  return db
    .prepare<[number], EventRow>('SELECT * FROM events WHERE id = ?')
    .get(Number(insert.lastInsertRowid)) as EventRow;
}

export function createEventSeries(
  payloads: {
    name: string;
    description: string;
    workingGroupId: number;
    startAt: string;
    endAt: string;
    location: string;
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
      seriesUuid,
      payload.recurrence,
      payload.seriesEndAt
    )
  );
}

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

export function updateEvent(
  id: number,
  name: string,
  description: string,
  workingGroupId: number,
  startAt: string,
  endAt: string,
  location: string
): (EventRow & { working_group_name?: string }) | undefined {
  db.prepare<[string, string, number, string, string, string, number]>(
    'UPDATE events SET name = ?, description = ?, working_group_id = ?, start_at = ?, end_at = ?, location = ? WHERE id = ?'
  ).run(name, description, workingGroupId, startAt, endAt, location, id);

  return findEventById(id);
}

export function deleteEventsBySeries(seriesUuid: string): void {
  db.prepare<[string]>('DELETE FROM events WHERE series_uuid = ?').run(seriesUuid);
}

export function deleteEventById(id: number): void {
  db.prepare<[number]>('DELETE FROM events WHERE id = ?').run(id);
}

export function listEventsBySeries(seriesUuid: string): EventRow[] {
  return db
    .prepare<[string], EventRow>('SELECT * FROM events WHERE series_uuid = ? ORDER BY start_at ASC')
    .all(seriesUuid);
}

export function addEventAttendee(userId: number, eventId: number): EventAttendeeRow {
  db.prepare<[number, number]>('INSERT OR IGNORE INTO event_attendees (user_id, event_id) VALUES (?, ?)').run(
    userId,
    eventId
  );
  return db
    .prepare<[number, number], EventAttendeeRow>('SELECT * FROM event_attendees WHERE user_id = ? AND event_id = ?')
    .get(userId, eventId) as EventAttendeeRow;
}

export function deleteEventAttendee(userId: number, eventId: number): void {
  db.prepare<[number, number]>('DELETE FROM event_attendees WHERE user_id = ? AND event_id = ?').run(userId, eventId);
}

export function listUserEventIds(userId: number): number[] {
  return db
    .prepare<[number], { event_id: number }>('SELECT event_id FROM event_attendees WHERE user_id = ?')
    .all(userId)
    .map((row) => row.event_id);
}
