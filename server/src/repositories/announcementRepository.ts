import { db } from '../db/connection';
import { AnnouncementRow } from '../types';

/**
 * Returns announcements ordered by newest first with cursor pagination.
 */
export function listAnnouncements(limit: number, cursor?: number): AnnouncementRow[] {
  if (cursor) {
    return db
      .prepare<[number, number], AnnouncementRow>(
        'SELECT * FROM announcements WHERE id < ? ORDER BY id DESC LIMIT ?'
      )
      .all(cursor, limit);
  }

  return db
    .prepare<[number], AnnouncementRow>('SELECT * FROM announcements ORDER BY id DESC LIMIT ?')
    .all(limit);
}

/**
 * Inserts a new announcement and returns the persisted row.
 */
export function createAnnouncement(body: string): AnnouncementRow {
  const insert = db.prepare<[string]>('INSERT INTO announcements (body) VALUES (?)').run(body);
  return db
    .prepare<[number], AnnouncementRow>('SELECT * FROM announcements WHERE id = ?')
    .get(Number(insert.lastInsertRowid)) as AnnouncementRow;
}
