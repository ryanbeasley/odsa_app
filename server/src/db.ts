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
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    user_id INTEGER PRIMARY KEY,
    token TEXT NOT NULL,
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

type GreetingRow = { message: string };
type AnnouncementRow = { id: number; body: string; created_at: string };
export type SupportLinkRow = {
  id: number;
  title: string;
  description: string;
  link: string;
  position: number;
  created_at: string;
};
export type PushSubscriptionRow = { user_id: number; token: string; created_at: string };
export type WebPushSubscriptionRow = {
  id: number;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};
export type WorkingGroupRow = {
  id: number;
  name: string;
  description: string;
  members: string;
  created_at: string;
};
export type EventRow = {
  id: number;
  name: string;
  description: string;
  working_group_id: number;
  start_at: string;
  end_at: string;
  location: string;
  series_uuid: string | null;
  recurrence: string | null;
  series_end_at: string | null;
  created_at: string;
};
export type EventAttendeeRow = {
  user_id: number;
  event_id: number;
  created_at: string;
};

const supportLinksColumns = db.prepare<[], { name: string }>('PRAGMA table_info(support_links)').all();
const hasPosition = supportLinksColumns.some((col) => col.name === 'position');
if (!hasPosition) {
  db.prepare('ALTER TABLE support_links ADD COLUMN position INTEGER NOT NULL DEFAULT 0').run();
  const rows = db
    .prepare<[], SupportLinkRow>('SELECT * FROM support_links ORDER BY created_at ASC, id ASC')
    .all();
  rows.forEach((row, index) => {
    db.prepare<[number, number]>('UPDATE support_links SET position = ? WHERE id = ?').run(index, row.id);
  });
}

const eventColumns = db.prepare<[], { name: string }>('PRAGMA table_info(events)').all();
const hasEndAt = eventColumns.some((col) => col.name === 'end_at');
if (!hasEndAt) {
  db.prepare('ALTER TABLE events ADD COLUMN end_at TEXT NOT NULL DEFAULT ""').run();
  const events = db.prepare<[], EventRow>('SELECT * FROM events').all();
  events.forEach((event) => {
    const fallback = event.start_at && event.start_at.trim() ? event.start_at : new Date().toISOString();
    db.prepare<[string, number]>('UPDATE events SET end_at = ? WHERE id = ?').run(fallback, event.id);
  });
}
const hasSeriesUuid = eventColumns.some((col) => col.name === 'series_uuid');
if (!hasSeriesUuid) {
  db.prepare('ALTER TABLE events ADD COLUMN series_uuid TEXT').run();
}
const hasRecurrence = eventColumns.some((col) => col.name === 'recurrence');
if (!hasRecurrence) {
  db.prepare('ALTER TABLE events ADD COLUMN recurrence TEXT').run();
}
const hasSeriesEndAt = eventColumns.some((col) => col.name === 'series_end_at');
if (!hasSeriesEndAt) {
  db.prepare('ALTER TABLE events ADD COLUMN series_end_at TEXT').run();
}

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

const supportLinkCount = db
  .prepare<[], { count: number }>('SELECT COUNT(*) as count FROM support_links')
  .get();

if (!supportLinkCount?.count) {
  const seedLinks = [
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

  const insert = db.prepare<[string, string, string]>(
    'INSERT INTO support_links (title, description, link) VALUES (?, ?, ?)'
  );

  seedLinks.forEach((row, index) => {
    const result = insert.run(row.title, row.description, row.link);
    db.prepare<[number, number]>('UPDATE support_links SET position = ? WHERE id = ?').run(
      index,
      Number(result.lastInsertRowid)
    );
  });
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

export function listSupportLinks(): SupportLinkRow[] {
  return db
    .prepare<[], SupportLinkRow>(
      'SELECT * FROM support_links ORDER BY position ASC, created_at ASC, id ASC'
    )
    .all();
}

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

export function deleteSupportLink(id: number): void {
  db.prepare<[number]>('DELETE FROM support_links WHERE id = ?').run(id);
}

export function reorderSupportLinks(ids: number[]): SupportLinkRow[] {
  const applyOrder = db.transaction((orderedIds: number[]) => {
    orderedIds.forEach((linkId, index) => {
      db.prepare<[number, number]>('UPDATE support_links SET position = ? WHERE id = ?').run(index, linkId);
    });
  });

  applyOrder(ids);
  return listSupportLinks();
}

export function upsertPushSubscription(userId: number, token: string): PushSubscriptionRow {
  db.prepare<[number, string]>(
    'INSERT INTO push_subscriptions (user_id, token) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET token = excluded.token'
  ).run(userId, token);

  return db
    .prepare<[number], PushSubscriptionRow>('SELECT * FROM push_subscriptions WHERE user_id = ?')
    .get(userId) as PushSubscriptionRow;
}

export function deletePushSubscription(userId: number): void {
  db.prepare<[number]>('DELETE FROM push_subscriptions WHERE user_id = ?').run(userId);
}

export function listPushSubscriptions(): PushSubscriptionRow[] {
  return db
    .prepare<[], PushSubscriptionRow>('SELECT * FROM push_subscriptions')
    .all();
}

export function findPushSubscriptionByUserId(userId: number): PushSubscriptionRow | undefined {
  return db
    .prepare<[number], PushSubscriptionRow>('SELECT * FROM push_subscriptions WHERE user_id = ?')
    .get(userId);
}

export function upsertWebPushSubscription(
  userId: number,
  endpoint: string,
  p256dh: string,
  auth: string
): WebPushSubscriptionRow {
  const existing = db
    .prepare<[string], WebPushSubscriptionRow>('SELECT * FROM web_push_subscriptions WHERE endpoint = ?')
    .get(endpoint);

  if (existing) {
    db.prepare<[number, string, string, number]>(
      'UPDATE web_push_subscriptions SET user_id = ?, p256dh = ?, auth = ? WHERE id = ?'
    ).run(userId, p256dh, auth, existing.id);
  } else {
    db.prepare<[number, string, string, string]>(
      'INSERT INTO web_push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)'
    ).run(userId, endpoint, p256dh, auth);
  }

  return db
    .prepare<[string], WebPushSubscriptionRow>('SELECT * FROM web_push_subscriptions WHERE endpoint = ?')
    .get(endpoint) as WebPushSubscriptionRow;
}

export function deleteWebPushSubscription(endpoint: string): void {
  db.prepare<[string]>('DELETE FROM web_push_subscriptions WHERE endpoint = ?').run(endpoint);
}

export function listWebPushSubscriptions(): WebPushSubscriptionRow[] {
  return db
    .prepare<[], WebPushSubscriptionRow>('SELECT * FROM web_push_subscriptions')
    .all();
}

export function findWebPushSubscriptionByEndpoint(endpoint: string): WebPushSubscriptionRow | undefined {
  return db
    .prepare<[string], WebPushSubscriptionRow>('SELECT * FROM web_push_subscriptions WHERE endpoint = ?')
    .get(endpoint);
}

export function listWorkingGroups(): WorkingGroupRow[] {
  return db
    .prepare<[], WorkingGroupRow>('SELECT * FROM working_groups ORDER BY created_at DESC, id DESC')
    .all();
}

export function findWorkingGroupById(id: number): WorkingGroupRow | undefined {
  return db.prepare<[number], WorkingGroupRow>('SELECT * FROM working_groups WHERE id = ?').get(id);
}

export function createWorkingGroup(name: string, description: string, members: string): WorkingGroupRow {
  const insert = db
    .prepare<[string, string, string]>(
      'INSERT INTO working_groups (name, description, members) VALUES (?, ?, ?)'
    )
    .run(name, description, members);

  return db
    .prepare<[number], WorkingGroupRow>('SELECT * FROM working_groups WHERE id = ?')
    .get(Number(insert.lastInsertRowid)) as WorkingGroupRow;
}

export function updateWorkingGroup(id: number, name: string, description: string, members: string): WorkingGroupRow | undefined {
  db
    .prepare<[string, string, string, number]>(
      'UPDATE working_groups SET name = ?, description = ?, members = ? WHERE id = ?'
    )
    .run(name, description, members, id);

  return db.prepare<[number], WorkingGroupRow>('SELECT * FROM working_groups WHERE id = ?').get(id);
}

export function listEvents(): (EventRow & { working_group_name?: string })[] {
  return db
    .prepare<[], EventRow & { working_group_name?: string }>(
      `SELECT e.*, wg.name as working_group_name
       FROM events e
       LEFT JOIN working_groups wg ON wg.id = e.working_group_id
       ORDER BY e.start_at DESC, e.created_at DESC`
    )
    .all();
}

export function listUpcomingEvents(nowIso: string): (EventRow & { working_group_name?: string })[] {
  return db
    .prepare<[string], EventRow & { working_group_name?: string }>(
      `SELECT e.*, wg.name as working_group_name
       FROM events e
       LEFT JOIN working_groups wg ON wg.id = e.working_group_id
       WHERE e.end_at >= ?
       ORDER BY e.start_at ASC, e.created_at ASC`
    )
    .all(nowIso);
}

export function createEvent(
  name: string,
  description: string,
  workingGroupId: number,
  startAt: string,
  endAt: string,
  location: string,
  seriesUuid: string | null,
  recurrence: string | null,
  seriesEndAt: string | null
): EventRow {
  const insert = db
    .prepare<[string, string, number, string, string, string, string | null, string | null, string | null]>(
      'INSERT INTO events (name, description, working_group_id, start_at, end_at, location, series_uuid, recurrence, series_end_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(name, description, workingGroupId, startAt, endAt, location, seriesUuid, recurrence, seriesEndAt);

  return db
    .prepare<[number], EventRow>('SELECT * FROM events WHERE id = ?')
    .get(Number(insert.lastInsertRowid)) as EventRow;
}

export function findEventById(id: number): (EventRow & { working_group_name?: string }) | undefined {
  return db
    .prepare<[number], EventRow & { working_group_name?: string }>(
      `SELECT e.*, wg.name as working_group_name
       FROM events e
       LEFT JOIN working_groups wg ON wg.id = e.working_group_id
       WHERE e.id = ?`
    )
    .get(id);
}

export function updateEvent(
  id: number,
  name: string,
  description: string,
  workingGroupId: number,
  startAt: string,
  endAt: string,
  location: string
): (EventRow & { working_group_name?: string }) | undefined {
  db.prepare<[string, string, number, string, string, string, number]>(
    'UPDATE events SET name = ?, description = ?, working_group_id = ?, start_at = ?, end_at = ?, location = ? WHERE id = ?'
  ).run(name, description, workingGroupId, startAt, endAt, location, id);

  return findEventById(id);
}

export function deleteEventsBySeries(seriesUuid: string): void {
  db.prepare<[string]>('DELETE FROM events WHERE series_uuid = ?').run(seriesUuid);
}

export function deleteEventById(id: number): void {
  db.prepare<[number]>('DELETE FROM events WHERE id = ?').run(id);
}

export function listEventsBySeries(seriesUuid: string): EventRow[] {
  return db
    .prepare<[string], EventRow>('SELECT * FROM events WHERE series_uuid = ? ORDER BY start_at ASC')
    .all(seriesUuid);
}

export function addEventAttendee(userId: number, eventId: number): EventAttendeeRow {
  db.prepare<[number, number]>(
    'INSERT OR IGNORE INTO event_attendees (user_id, event_id) VALUES (?, ?)'
  ).run(userId, eventId);
  return db
    .prepare<[number, number], EventAttendeeRow>(
      'SELECT * FROM event_attendees WHERE user_id = ? AND event_id = ?'
    )
    .get(userId, eventId) as EventAttendeeRow;
}

export function deleteEventAttendee(userId: number, eventId: number): void {
  db.prepare<[number, number]>('DELETE FROM event_attendees WHERE user_id = ? AND event_id = ?').run(userId, eventId);
}

export function listUserEventIds(userId: number): number[] {
  return db
    .prepare<[number], { event_id: number }>('SELECT event_id FROM event_attendees WHERE user_id = ?')
    .all(userId)
    .map((row) => row.event_id);
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
