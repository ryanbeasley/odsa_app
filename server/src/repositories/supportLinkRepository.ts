import { db } from '../db/connection';
import { SupportLinkRow } from '../types';

/**
 * Returns all support links ordered by their position.
 */
export function listSupportLinks(): SupportLinkRow[] {
  return db
    .prepare<[], SupportLinkRow>('SELECT * FROM support_links ORDER BY position ASC, created_at ASC, id ASC')
    .all();
}

/**
 * Inserts a new support link at the end of the current list.
 */
export function createSupportLink(title: string, description: string, link: string): SupportLinkRow {
  const maxPositionRow = db
    .prepare<[], { maxPos: number | null }>('SELECT MAX(position) as maxPos FROM support_links')
    .get();
  const nextPosition = (maxPositionRow?.maxPos ?? -1) + 1;

  const insert = db
    .prepare<[string, string, string, number]>(
      'INSERT INTO support_links (title, description, link, position) VALUES (?, ?, ?, ?)'
    )
    .run(title, description, link, nextPosition);

  return db
    .prepare<[number], SupportLinkRow>('SELECT * FROM support_links WHERE id = ?')
    .get(Number(insert.lastInsertRowid)) as SupportLinkRow;
}

/**
 * Updates an existing support link.
 */
export function updateSupportLink(
  id: number,
  title: string,
  description: string,
  link: string
): SupportLinkRow | undefined {
  db.prepare<[string, string, string, number]>(
    'UPDATE support_links SET title = ?, description = ?, link = ? WHERE id = ?'
  ).run(title, description, link, id);

  return db.prepare<[number], SupportLinkRow>('SELECT * FROM support_links WHERE id = ?').get(id);
}

/**
 * Deletes a support link by ID.
 */
export function deleteSupportLink(id: number): void {
  db.prepare<[number]>('DELETE FROM support_links WHERE id = ?').run(id);
}

/**
 * Applies a new ordering to support links and returns the updated list.
 */
export function reorderSupportLinks(ids: number[]): SupportLinkRow[] {
  const applyOrder = db.transaction((orderedIds: number[]) => {
    orderedIds.forEach((linkId, index) => {
      db.prepare<[number, number]>('UPDATE support_links SET position = ? WHERE id = ?').run(index, linkId);
    });
  });

  applyOrder(ids);
  return listSupportLinks();
}
