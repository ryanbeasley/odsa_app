import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const DEFAULT_DB_PATH = path.resolve(__dirname, '../data/app.db');
const dbPath = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : DEFAULT_DB_PATH;

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.prepare(
  `CREATE TABLE IF NOT EXISTS greeting (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    message TEXT NOT NULL
  )`
).run();

db.prepare(
  `CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`
).run();

type GreetingRow = { message: string };
type AnnouncementRow = { id: number; body: string; created_at: string };

const existing = db
  .prepare<[], GreetingRow>('SELECT message FROM greeting WHERE id = 1')
  .get();
if (!existing) {
  db.prepare('INSERT INTO greeting (id, message) VALUES (1, ?)').run('Hello from ODSA!');
}

const announcementCount = db
  .prepare<[], { count: number }>('SELECT COUNT(*) as count FROM announcements')
  .get();

if (!announcementCount?.count) {
  const seedMessage = existing?.message ?? 'Hello from ODSA!';
  db.prepare('INSERT INTO announcements (body) VALUES (?)').run(seedMessage);
}

db.prepare(
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'admin'))
  )`
).run();

export type Role = 'user' | 'admin';

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  role: Role;
}

export type { AnnouncementRow };

export function listAnnouncements(limit: number, cursor?: number): AnnouncementRow[] {
  if (cursor) {
    return db
      .prepare<[number, number], AnnouncementRow>(
        'SELECT * FROM announcements WHERE id < ? ORDER BY id DESC LIMIT ?'
      )
      .all(cursor, limit);
  }

  return db
    .prepare<[number], AnnouncementRow>(
      'SELECT * FROM announcements ORDER BY id DESC LIMIT ?'
    )
    .all(limit);
}

export function createAnnouncement(body: string): AnnouncementRow {
  const insert = db
    .prepare<[string]>('INSERT INTO announcements (body) VALUES (?)')
    .run(body);

  return db
    .prepare<[number], AnnouncementRow>('SELECT * FROM announcements WHERE id = ?')
    .get(Number(insert.lastInsertRowid)) as AnnouncementRow;
}

export function findUserByEmail(email: string): UserRow | undefined {
  return db
    .prepare<[string], UserRow>('SELECT * FROM users WHERE email = ?')
    .get(email);
}

export function findUserById(id: number): UserRow | undefined {
  return db
    .prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?')
    .get(id);
}

export function createUser(email: string, passwordHash: string, role: Role): UserRow {
  const info = db
    .prepare<[string, string, Role]>(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)'
    )
    .run(email, passwordHash, role);

  return {
    id: Number(info.lastInsertRowid),
    email,
    password_hash: passwordHash,
    role,
  };
}

const seedAdminEmail = process.env.ADMIN_EMAIL;
const seedAdminPassword = process.env.ADMIN_PASSWORD;
if (seedAdminEmail && seedAdminPassword) {
  const existingAdmin = findUserByEmail(seedAdminEmail);
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(seedAdminPassword, 10);
    createUser(seedAdminEmail, hash, 'admin');
    // eslint-disable-next-line no-console
    console.log(`Seeded admin user ${seedAdminEmail}`);
  }
}
