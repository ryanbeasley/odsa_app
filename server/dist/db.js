"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAnnouncements = listAnnouncements;
exports.createAnnouncement = createAnnouncement;
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
