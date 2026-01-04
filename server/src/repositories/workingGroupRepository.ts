import { db } from '../db/connection';
import { WorkingGroupRow } from '../types';

/**
 * Returns all working groups ordered by creation date.
 */
export function listWorkingGroups(): WorkingGroupRow[] {
  console.logEnter();
  return db.prepare<[], WorkingGroupRow>('SELECT * FROM working_groups ORDER BY created_at DESC, id DESC').all();
}

/**
 * Retrieves a working group by its primary key.
 */
export function findWorkingGroupById(id: number): WorkingGroupRow | undefined {
  console.logEnter();
  return db.prepare<[number], WorkingGroupRow>('SELECT * FROM working_groups WHERE id = ?').get(id);
}

/**
 * Retrieves a working group by name (case-insensitive).
 */
export function findWorkingGroupByName(name: string): WorkingGroupRow | undefined {
  console.logEnter();
  return db
    .prepare<[string], WorkingGroupRow>('SELECT * FROM working_groups WHERE LOWER(name) = LOWER(?)')
    .get(name.trim());
}

/**
 * Inserts a new working group row.
 */
export function createWorkingGroup(name: string, description: string, members: string): WorkingGroupRow {
  console.logEnter();
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
  console.logEnter();
  db.prepare<[string, string, string, number]>(
    'UPDATE working_groups SET name = ?, description = ?, members = ? WHERE id = ?'
  ).run(name, description, members, id);

  return db.prepare<[number], WorkingGroupRow>('SELECT * FROM working_groups WHERE id = ?').get(id);
}

/**
 * Deletes a working group by ID.
 */
export function deleteWorkingGroup(id: number): void {
  console.logEnter();
  db.prepare<[number]>('DELETE FROM working_groups WHERE id = ?').run(id);
}
