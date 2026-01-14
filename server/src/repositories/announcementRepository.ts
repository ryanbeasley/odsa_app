import { db } from '../db/connection';
import { AnnouncementRow } from '../types';
import { listTagsByEntityIds, upsertTagsForEntity } from './tagRepository';

type AnnouncementWithTags = AnnouncementRow & { tags: string[]; author_username: string | null };

/**
 * Returns announcements ordered by newest first with cursor pagination.
 */
export function listAnnouncements(limit: number, cursor?: number): AnnouncementWithTags[] {
  console.logEnter();
  const rows = cursor
    ? db
        .prepare<[number, number], AnnouncementWithTags>(
          `SELECT announcements.*, users.username as author_username
           FROM announcements
           LEFT JOIN users ON users.id = announcements.user_id
           WHERE announcements.id < ?
           ORDER BY announcements.id DESC
           LIMIT ?`
        )
        .all(cursor, limit)
    : db
        .prepare<[number], AnnouncementWithTags>(
          `SELECT announcements.*, users.username as author_username
           FROM announcements
           LEFT JOIN users ON users.id = announcements.user_id
           ORDER BY announcements.id DESC
           LIMIT ?`
        )
        .all(limit);
  const ids = rows.map((row) => row.id);
  const tagsById = listTagsByEntityIds('announcement', ids);
  return rows.map((row) => ({ ...row, tags: tagsById.get(row.id) ?? [] }));
}

/**
 * Inserts a new announcement and returns the persisted row.
 */
export function createAnnouncement(body: string, userId: number, tags: string[] = []): AnnouncementWithTags {
  console.logEnter();
  const insert = db.prepare<[string, number]>('INSERT INTO announcements (body, user_id) VALUES (?, ?)').run(body, userId);
  const announcement = db
    .prepare<[number], AnnouncementWithTags>(
      `SELECT announcements.*, users.username as author_username
       FROM announcements
       LEFT JOIN users ON users.id = announcements.user_id
       WHERE announcements.id = ?`
    )
    .get(Number(insert.lastInsertRowid)) as AnnouncementWithTags;
  if (announcement) {
    upsertTagsForEntity('announcement', announcement.id, tags);
  }
  return { ...announcement, tags };
}
