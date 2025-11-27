import { db } from '../db/connection';
import { WorkingGroupRow } from '../types';

/**
 * Returns all working groups ordered by creation date.
 */
export function listWorkingGroups(): WorkingGroupRow[] {
  return db.prepare<[], WorkingGroupRow>('SELECT * FROM working_groups ORDER BY created_at DESC, id DESC').all();
}

/**
 * Retrieves a working group by its primary key.
 */
export function findWorkingGroupById(id: number): WorkingGroupRow | undefined {
  return db.prepare<[number], WorkingGroupRow>('SELECT * FROM working_groups WHERE id = ?').get(id);
}

/**
 * Inserts a new working group row.
 */
export function createWorkingGroup(name: string, description: string, members: string): WorkingGroupRow {
  const insert = db
    .prepare<[string, string, string]>('INSERT INTO working_groups (name, description, members) VALUES (?, ?, ?)')
    .run(name, description, members);

  return db
    .prepare<[number], WorkingGroupRow>('SELECT * FROM working_groups WHERE id = ?')
    .get(Number(insert.lastInsertRowid)) as WorkingGroupRow;
}

/**
 * Updates an existing working group row.
 */
export function updateWorkingGroup(
  id: number,
  name: string,
  description: string,
  members: string
): WorkingGroupRow | undefined {
  db.prepare<[string, string, string, number]>(
    'UPDATE working_groups SET name = ?, description = ?, members = ? WHERE id = ?'
  ).run(name, description, members, id);

  return db.prepare<[number], WorkingGroupRow>('SELECT * FROM working_groups WHERE id = ?').get(id);
}

/**
 * Deletes a working group by ID.
 */
export function deleteWorkingGroup(id: number): void {
  db.prepare<[number]>('DELETE FROM working_groups WHERE id = ?').run(id);
}
