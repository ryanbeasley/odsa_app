import { db } from '../db/connection';
import { WorkingGroupRow } from '../types';

export function listWorkingGroups(): WorkingGroupRow[] {
  return db.prepare<[], WorkingGroupRow>('SELECT * FROM working_groups ORDER BY created_at DESC, id DESC').all();
}

export function findWorkingGroupById(id: number): WorkingGroupRow | undefined {
  return db.prepare<[number], WorkingGroupRow>('SELECT * FROM working_groups WHERE id = ?').get(id);
}

export function createWorkingGroup(name: string, description: string, members: string): WorkingGroupRow {
  const insert = db
    .prepare<[string, string, string]>('INSERT INTO working_groups (name, description, members) VALUES (?, ?, ?)')
    .run(name, description, members);

  return db
    .prepare<[number], WorkingGroupRow>('SELECT * FROM working_groups WHERE id = ?')
    .get(Number(insert.lastInsertRowid)) as WorkingGroupRow;
}

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
