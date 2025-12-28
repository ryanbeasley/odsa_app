import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { Role } from '../types';

const DEFAULT_DB_PATH = path.resolve(__dirname, '../../data/app.db');
const dbPath = process.env.DB_PATH ? path.resolve(process.cwd(), process.env.DB_PATH) : DEFAULT_DB_PATH;

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);

const supportLinkSeeds = [
  {
    title: 'Contact organizers',
    description: 'Email the steering committee for access or tech help.',
    link: 'mailto:info@dsausa.org',
  },
  {
    title: 'National DSA',
    description: 'Learn more about national campaigns and resources.',
    link: 'https://www.dsausa.org/',
  },
];

/**
 * Creates the necessary tables if they do not already exist.
 */
function ensureTables() {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS support_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      link TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
      first_name TEXT,
      last_name TEXT,
      phone TEXT
    )`
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS push_subscriptions (
      user_id INTEGER PRIMARY KEY,
      token TEXT NOT NULL,
      announcement_alerts_enabled INTEGER NOT NULL DEFAULT 1,
      event_alerts_enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS web_push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS working_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      members TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      working_group_id INTEGER NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      location TEXT NOT NULL,
      location_display_name TEXT,
      discord_event_id TEXT,
      series_uuid TEXT,
      recurrence TEXT,
      series_end_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (working_group_id) REFERENCES working_groups(id) ON DELETE CASCADE
    )`
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS event_attendees (
      user_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, event_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    )`
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS event_notification_logs (
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      notification_type TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (event_id, user_id, notification_type),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  ).run();
}

/**
 * Applies schema migrations such as adding new columns.
 */
function runMigrations() {
  const supportLinksColumns = db.prepare<[], { name: string }>('PRAGMA table_info(support_links)').all();
  if (!supportLinksColumns.some((col) => col.name === 'position')) {
    db.prepare('ALTER TABLE support_links ADD COLUMN position INTEGER NOT NULL DEFAULT 0').run();
  const rows = db
    .prepare('SELECT id FROM support_links ORDER BY created_at ASC, id ASC')
    .all() as Array<{ id: number }>;
  rows.forEach((row, index) => {
      db.prepare('UPDATE support_links SET position = ? WHERE id = ?').run(index, row.id);
    });
  }

  const eventColumns = db.prepare<[], { name: string }>('PRAGMA table_info(events)').all();
  const ensureColumn = (name: string, definition: string) => {
    if (!eventColumns.some((col) => col.name === name)) {
      db.prepare(`ALTER TABLE events ADD COLUMN ${definition}`).run();
    }
  };
  ensureColumn('end_at', 'end_at TEXT NOT NULL DEFAULT ""');
  ensureColumn('location_display_name', 'location_display_name TEXT');
  ensureColumn('discord_event_id', 'discord_event_id TEXT');
  ensureColumn('series_uuid', 'series_uuid TEXT');
  ensureColumn('recurrence', 'recurrence TEXT');
  ensureColumn('series_end_at', 'series_end_at TEXT');
  db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS events_discord_event_id_idx ON events(discord_event_id)').run();

  const userColumns = db.prepare<[], { name: string }>('PRAGMA table_info(users)').all();
  if (!userColumns.some((col) => col.name === 'first_name')) {
    db.prepare('ALTER TABLE users ADD COLUMN first_name TEXT').run();
  }
  if (!userColumns.some((col) => col.name === 'last_name')) {
    db.prepare('ALTER TABLE users ADD COLUMN last_name TEXT').run();
  }
  if (!userColumns.some((col) => col.name === 'phone')) {
    db.prepare('ALTER TABLE users ADD COLUMN phone TEXT').run();
  }

  const pushColumns = db.prepare<[], { name: string }>('PRAGMA table_info(push_subscriptions)').all();
  if (!pushColumns.some((col) => col.name === 'announcement_alerts_enabled')) {
    db.prepare('ALTER TABLE push_subscriptions ADD COLUMN announcement_alerts_enabled INTEGER NOT NULL DEFAULT 1').run();
  }
  if (!pushColumns.some((col) => col.name === 'event_alerts_enabled')) {
    db.prepare('ALTER TABLE push_subscriptions ADD COLUMN event_alerts_enabled INTEGER NOT NULL DEFAULT 0').run();
  }
}

/**
 * Seeds default support links if none exist.
 */
function seedSupportLinks() {
  const existing = db.prepare('SELECT COUNT(*) as count FROM support_links').get() as { count: number };
  if (existing.count) {
    return;
  }
  const insert = db.prepare('INSERT INTO support_links (title, description, link, position) VALUES (?, ?, ?, ?)');
  supportLinkSeeds.forEach((row, index) => {
    insert.run(row.title, row.description, row.link, index);
  });
}

/**
 * Seeds an admin user using env-provided credentials if the user is missing.
 */
function seedAdminUser() {
  const seedAdminEmail = process.env.ADMIN_EMAIL;
  const seedAdminPassword = process.env.ADMIN_PASSWORD;
  if (!seedAdminEmail || !seedAdminPassword) {
    return;
  }
  const existing = db
    .prepare('SELECT 1 FROM users WHERE email = ?')
    .get(seedAdminEmail.trim().toLowerCase());
  if (existing) {
    return;
  }
  const hash = bcrypt.hashSync(seedAdminPassword, 10);
  db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)').run(
    seedAdminEmail.trim().toLowerCase(),
    hash,
    'admin' as Role
  );
  // eslint-disable-next-line no-console
  console.log(`Seeded admin user ${seedAdminEmail}`);
}

ensureTables();
runMigrations();
seedSupportLinks();
seedAdminUser();
