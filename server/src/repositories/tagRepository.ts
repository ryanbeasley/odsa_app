import { db } from '../db/connection';

export type TagEntityType = 'announcement' | 'event';

/**
 * Replaces tags for a given entity with the provided list.
 */
export function upsertTagsForEntity(entityType: TagEntityType, entityId: number, tags: string[]) {
  console.logEnter();
  const normalized = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
  const run = db.transaction(() => {
    db.prepare<[TagEntityType, number]>('DELETE FROM tags WHERE entity_type = ? AND entity_id = ?').run(
      entityType,
      entityId
    );
    if (!normalized.length) {
      return;
    }
    const insert = db.prepare<[TagEntityType, number, string]>(
      'INSERT INTO tags (entity_type, entity_id, tag_name) VALUES (?, ?, ?)'
    );
    normalized.forEach((tag) => {
      insert.run(entityType, entityId, tag);
    });
  });
  run();
}

/**
 * Lists all distinct tags across entity types.
 */
export function listDistinctTags(): string[] {
  console.logEnter();
  const rows = db.prepare<[], { tag_name: string }>('SELECT DISTINCT tag_name FROM tags ORDER BY tag_name COLLATE NOCASE').all();
  return rows.map((row) => row.tag_name);
}

/**
 * Returns tags grouped by entity id for the given entity type.
 */
export function listTagsByEntityIds(entityType: TagEntityType, entityIds: number[]): Map<number, string[]> {
  console.logEnter();
  const result = new Map<number, string[]>();
  if (!entityIds.length) {
    return result;
  }
  const placeholders = entityIds.map(() => '?').join(',');
  const rows = db
    .prepare<unknown[], { entity_id: number; tag_name: string }>(
      `SELECT entity_id, tag_name FROM tags WHERE entity_type = ? AND entity_id IN (${placeholders}) ORDER BY tag_name`
    )
    .all(entityType, ...entityIds) as Array<{ entity_id: number; tag_name: string }>;
  rows.forEach((row) => {
    const entry = result.get(row.entity_id);
    if (entry) {
      entry.push(row.tag_name);
    } else {
      result.set(row.entity_id, [row.tag_name]);
    }
  });
  return result;
}
