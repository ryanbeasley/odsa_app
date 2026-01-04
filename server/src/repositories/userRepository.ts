import { db } from '../db/connection';
import { Role, UserRow } from '../types';

/**
 * Finds a user row by email address.
 */
export function findUserByEmail(email: string): UserRow | undefined {
  console.logEnter();
  return db.prepare<[string], UserRow>('SELECT * FROM users WHERE email = ?').get(email);
}

/**
 * Finds a user row by username.
 */
export function findUserByUsername(username: string): UserRow | undefined {
  console.logEnter();
  return db.prepare<[string], UserRow>('SELECT * FROM users WHERE username = ?').get(username);
}

/**
 * Finds a user row by primary key.
 */
export function findUserById(id: number): UserRow | undefined {
  console.logEnter();
  return db.prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?').get(id);
}

/**
 * Inserts a new user with the given credentials.
 */
export function createUser(email: string | null, username: string, passwordHash: string, role: Role): UserRow {
  console.logEnter();
  const info = db
    .prepare<[string | null, string, string, Role]>(
      'INSERT INTO users (email, username, password_hash, role) VALUES (?, ?, ?, ?)'
    )
    .run(email, username, passwordHash, role);

  return findUserById(Number(info.lastInsertRowid)) as UserRow;
}

/**
 * Lists users optionally filtered by a search term.
 */
export function listUsers(search?: string): UserRow[] {
  console.logEnter();
  if (search?.trim()) {
    const term = `%${search.trim().toLowerCase()}%`;
    return db
      .prepare<[string, string, string, string], UserRow>(
        `SELECT * FROM users
         WHERE LOWER(COALESCE(email, '')) LIKE ?
            OR LOWER(username) LIKE ?
            OR LOWER(COALESCE(first_name, '')) LIKE ?
            OR LOWER(COALESCE(last_name, '')) LIKE ?
         ORDER BY username ASC`
      )
      .all(term, term, term, term);
  }

  return db.prepare<[], UserRow>('SELECT * FROM users ORDER BY username ASC').all();
}

/**
 * Updates profile fields for a user.
 */
export function updateUserProfile(
  id: number,
  updates: {
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    username?: string;
    event_alerts_sms_enabled?: number;
  }
): UserRow | undefined {
  console.logEnter();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  if (updates.email !== undefined) {
    fields.push('email = ?');
    values.push(updates.email);
  }
  if (updates.first_name !== undefined) {
    fields.push('first_name = ?');
    values.push(updates.first_name);
  }
  if (updates.last_name !== undefined) {
    fields.push('last_name = ?');
    values.push(updates.last_name);
  }
  if (updates.phone !== undefined) {
    fields.push('phone = ?');
    values.push(updates.phone);
  }
  if (updates.username !== undefined) {
    fields.push('username = ?');
    values.push(updates.username);
  }
  if (updates.event_alerts_sms_enabled !== undefined) {
    fields.push('event_alerts_sms_enabled = ?');
    values.push(updates.event_alerts_sms_enabled);
  }
  if (!fields.length) {
    return findUserById(id);
  }
  values.push(id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return findUserById(id);
}

/**
 * Updates a user's role.
 */
export function updateUserRole(id: number, role: Role): UserRow | undefined {
  console.logEnter();
  db.prepare<[Role, number]>('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  return findUserById(id);
}
