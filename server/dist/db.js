"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAnnouncements = listAnnouncements;
exports.createAnnouncement = createAnnouncement;
exports.listSupportLinks = listSupportLinks;
exports.createSupportLink = createSupportLink;
exports.updateSupportLink = updateSupportLink;
exports.deleteSupportLink = deleteSupportLink;
exports.reorderSupportLinks = reorderSupportLinks;
exports.upsertPushSubscription = upsertPushSubscription;
exports.deletePushSubscription = deletePushSubscription;
exports.listPushSubscriptions = listPushSubscriptions;
exports.findPushSubscriptionByUserId = findPushSubscriptionByUserId;
exports.upsertWebPushSubscription = upsertWebPushSubscription;
exports.deleteWebPushSubscription = deleteWebPushSubscription;
exports.listWebPushSubscriptions = listWebPushSubscriptions;
exports.findWebPushSubscriptionByEndpoint = findWebPushSubscriptionByEndpoint;
exports.listWorkingGroups = listWorkingGroups;
exports.findWorkingGroupById = findWorkingGroupById;
exports.createWorkingGroup = createWorkingGroup;
exports.updateWorkingGroup = updateWorkingGroup;
exports.listEvents = listEvents;
exports.listUpcomingEvents = listUpcomingEvents;
exports.createEvent = createEvent;
exports.findEventById = findEventById;
exports.updateEvent = updateEvent;
exports.deleteEventsBySeries = deleteEventsBySeries;
exports.deleteEventById = deleteEventById;
exports.listEventsBySeries = listEventsBySeries;
exports.addEventAttendee = addEventAttendee;
exports.deleteEventAttendee = deleteEventAttendee;
exports.listUserEventIds = listUserEventIds;
exports.findUserByEmail = findUserByEmail;
exports.findUserById = findUserById;
exports.createUser = createUser;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const DEFAULT_DB_PATH = path_1.default.resolve(__dirname, '../data/app.db');
const dbPath = process.env.DB_PATH
    ? path_1.default.resolve(process.cwd(), process.env.DB_PATH)
    : DEFAULT_DB_PATH;
fs_1.default.mkdirSync(path_1.default.dirname(dbPath), { recursive: true });
const db = new better_sqlite3_1.default(dbPath);
db.prepare(`CREATE TABLE IF NOT EXISTS greeting (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    message TEXT NOT NULL
  )`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS support_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    link TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    user_id INTEGER PRIMARY KEY,
    token TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS web_push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS working_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    members TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS events (
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
  )`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS event_attendees (
    user_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, event_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  )`).run();
const supportLinksColumns = db.prepare('PRAGMA table_info(support_links)').all();
const hasPosition = supportLinksColumns.some((col) => col.name === 'position');
if (!hasPosition) {
    db.prepare('ALTER TABLE support_links ADD COLUMN position INTEGER NOT NULL DEFAULT 0').run();
    const rows = db
        .prepare('SELECT * FROM support_links ORDER BY created_at ASC, id ASC')
        .all();
    rows.forEach((row, index) => {
        db.prepare('UPDATE support_links SET position = ? WHERE id = ?').run(index, row.id);
    });
}
const eventColumns = db.prepare('PRAGMA table_info(events)').all();
const hasEndAt = eventColumns.some((col) => col.name === 'end_at');
if (!hasEndAt) {
    db.prepare('ALTER TABLE events ADD COLUMN end_at TEXT NOT NULL DEFAULT ""').run();
    const events = db.prepare('SELECT * FROM events').all();
    events.forEach((event) => {
        const fallback = event.start_at && event.start_at.trim() ? event.start_at : new Date().toISOString();
        db.prepare('UPDATE events SET end_at = ? WHERE id = ?').run(fallback, event.id);
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
    .prepare('SELECT message FROM greeting WHERE id = 1')
    .get();
if (!existing) {
    db.prepare('INSERT INTO greeting (id, message) VALUES (1, ?)').run('Hello from ODSA!');
}
const announcementCount = db
    .prepare('SELECT COUNT(*) as count FROM announcements')
    .get();
if (!announcementCount?.count) {
    const seedMessage = existing?.message ?? 'Hello from ODSA!';
    db.prepare('INSERT INTO announcements (body) VALUES (?)').run(seedMessage);
}
const supportLinkCount = db
    .prepare('SELECT COUNT(*) as count FROM support_links')
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
    const insert = db.prepare('INSERT INTO support_links (title, description, link) VALUES (?, ?, ?)');
    seedLinks.forEach((row, index) => {
        const result = insert.run(row.title, row.description, row.link);
        db.prepare('UPDATE support_links SET position = ? WHERE id = ?').run(index, Number(result.lastInsertRowid));
    });
}
db.prepare(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'admin'))
  )`).run();
function listAnnouncements(limit, cursor) {
    if (cursor) {
        return db
            .prepare('SELECT * FROM announcements WHERE id < ? ORDER BY id DESC LIMIT ?')
            .all(cursor, limit);
    }
    return db
        .prepare('SELECT * FROM announcements ORDER BY id DESC LIMIT ?')
        .all(limit);
}
function createAnnouncement(body) {
    const insert = db
        .prepare('INSERT INTO announcements (body) VALUES (?)')
        .run(body);
    return db
        .prepare('SELECT * FROM announcements WHERE id = ?')
        .get(Number(insert.lastInsertRowid));
}
function listSupportLinks() {
    return db
        .prepare('SELECT * FROM support_links ORDER BY position ASC, created_at ASC, id ASC')
        .all();
}
function createSupportLink(title, description, link) {
    const maxPositionRow = db
        .prepare('SELECT MAX(position) as maxPos FROM support_links')
        .get();
    const nextPosition = (maxPositionRow?.maxPos ?? -1) + 1;
    const insert = db
        .prepare('INSERT INTO support_links (title, description, link, position) VALUES (?, ?, ?, ?)')
        .run(title, description, link, nextPosition);
    return db
        .prepare('SELECT * FROM support_links WHERE id = ?')
        .get(Number(insert.lastInsertRowid));
}
function updateSupportLink(id, title, description, link) {
    db.prepare('UPDATE support_links SET title = ?, description = ?, link = ? WHERE id = ?').run(title, description, link, id);
    return db.prepare('SELECT * FROM support_links WHERE id = ?').get(id);
}
function deleteSupportLink(id) {
    db.prepare('DELETE FROM support_links WHERE id = ?').run(id);
}
function reorderSupportLinks(ids) {
    const applyOrder = db.transaction((orderedIds) => {
        orderedIds.forEach((linkId, index) => {
            db.prepare('UPDATE support_links SET position = ? WHERE id = ?').run(index, linkId);
        });
    });
    applyOrder(ids);
    return listSupportLinks();
}
function upsertPushSubscription(userId, token) {
    db.prepare('INSERT INTO push_subscriptions (user_id, token) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET token = excluded.token').run(userId, token);
    return db
        .prepare('SELECT * FROM push_subscriptions WHERE user_id = ?')
        .get(userId);
}
function deletePushSubscription(userId) {
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(userId);
}
function listPushSubscriptions() {
    return db
        .prepare('SELECT * FROM push_subscriptions')
        .all();
}
function findPushSubscriptionByUserId(userId) {
    return db
        .prepare('SELECT * FROM push_subscriptions WHERE user_id = ?')
        .get(userId);
}
function upsertWebPushSubscription(userId, endpoint, p256dh, auth) {
    const existing = db
        .prepare('SELECT * FROM web_push_subscriptions WHERE endpoint = ?')
        .get(endpoint);
    if (existing) {
        db.prepare('UPDATE web_push_subscriptions SET user_id = ?, p256dh = ?, auth = ? WHERE id = ?').run(userId, p256dh, auth, existing.id);
    }
    else {
        db.prepare('INSERT INTO web_push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)').run(userId, endpoint, p256dh, auth);
    }
    return db
        .prepare('SELECT * FROM web_push_subscriptions WHERE endpoint = ?')
        .get(endpoint);
}
function deleteWebPushSubscription(endpoint) {
    db.prepare('DELETE FROM web_push_subscriptions WHERE endpoint = ?').run(endpoint);
}
function listWebPushSubscriptions() {
    return db
        .prepare('SELECT * FROM web_push_subscriptions')
        .all();
}
function findWebPushSubscriptionByEndpoint(endpoint) {
    return db
        .prepare('SELECT * FROM web_push_subscriptions WHERE endpoint = ?')
        .get(endpoint);
}
function listWorkingGroups() {
    return db
        .prepare('SELECT * FROM working_groups ORDER BY created_at DESC, id DESC')
        .all();
}
function findWorkingGroupById(id) {
    return db.prepare('SELECT * FROM working_groups WHERE id = ?').get(id);
}
function createWorkingGroup(name, description, members) {
    const insert = db
        .prepare('INSERT INTO working_groups (name, description, members) VALUES (?, ?, ?)')
        .run(name, description, members);
    return db
        .prepare('SELECT * FROM working_groups WHERE id = ?')
        .get(Number(insert.lastInsertRowid));
}
function updateWorkingGroup(id, name, description, members) {
    db
        .prepare('UPDATE working_groups SET name = ?, description = ?, members = ? WHERE id = ?')
        .run(name, description, members, id);
    return db.prepare('SELECT * FROM working_groups WHERE id = ?').get(id);
}
function listEvents() {
    return db
        .prepare(`SELECT e.*, wg.name as working_group_name
       FROM events e
       LEFT JOIN working_groups wg ON wg.id = e.working_group_id
       ORDER BY e.start_at DESC, e.created_at DESC`)
        .all();
}
function listUpcomingEvents(nowIso) {
    return db
        .prepare(`SELECT e.*, wg.name as working_group_name
       FROM events e
       LEFT JOIN working_groups wg ON wg.id = e.working_group_id
       WHERE e.end_at >= ?
       ORDER BY e.start_at ASC, e.created_at ASC`)
        .all(nowIso);
}
function createEvent(name, description, workingGroupId, startAt, endAt, location, seriesUuid, recurrence, seriesEndAt) {
    const insert = db
        .prepare('INSERT INTO events (name, description, working_group_id, start_at, end_at, location, series_uuid, recurrence, series_end_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(name, description, workingGroupId, startAt, endAt, location, seriesUuid, recurrence, seriesEndAt);
    return db
        .prepare('SELECT * FROM events WHERE id = ?')
        .get(Number(insert.lastInsertRowid));
}
function findEventById(id) {
    return db
        .prepare(`SELECT e.*, wg.name as working_group_name
       FROM events e
       LEFT JOIN working_groups wg ON wg.id = e.working_group_id
       WHERE e.id = ?`)
        .get(id);
}
function updateEvent(id, name, description, workingGroupId, startAt, endAt, location) {
    db.prepare('UPDATE events SET name = ?, description = ?, working_group_id = ?, start_at = ?, end_at = ?, location = ? WHERE id = ?').run(name, description, workingGroupId, startAt, endAt, location, id);
    return findEventById(id);
}
function deleteEventsBySeries(seriesUuid) {
    db.prepare('DELETE FROM events WHERE series_uuid = ?').run(seriesUuid);
}
function deleteEventById(id) {
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
}
function listEventsBySeries(seriesUuid) {
    return db
        .prepare('SELECT * FROM events WHERE series_uuid = ? ORDER BY start_at ASC')
        .all(seriesUuid);
}
function addEventAttendee(userId, eventId) {
    db.prepare('INSERT OR IGNORE INTO event_attendees (user_id, event_id) VALUES (?, ?)').run(userId, eventId);
    return db
        .prepare('SELECT * FROM event_attendees WHERE user_id = ? AND event_id = ?')
        .get(userId, eventId);
}
function deleteEventAttendee(userId, eventId) {
    db.prepare('DELETE FROM event_attendees WHERE user_id = ? AND event_id = ?').run(userId, eventId);
}
function listUserEventIds(userId) {
    return db
        .prepare('SELECT event_id FROM event_attendees WHERE user_id = ?')
        .all(userId)
        .map((row) => row.event_id);
}
function findUserByEmail(email) {
    return db
        .prepare('SELECT * FROM users WHERE email = ?')
        .get(email);
}
function findUserById(id) {
    return db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(id);
}
function createUser(email, passwordHash, role) {
    const info = db
        .prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
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
        const hash = bcryptjs_1.default.hashSync(seedAdminPassword, 10);
        createUser(seedAdminEmail, hash, 'admin');
        // eslint-disable-next-line no-console
        console.log(`Seeded admin user ${seedAdminEmail}`);
    }
}
