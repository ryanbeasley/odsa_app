"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAnnouncements = listAnnouncements;
exports.createAnnouncement = createAnnouncement;
const connection_1 = require("../db/connection");
function listAnnouncements(limit, cursor) {
    if (cursor) {
        return connection_1.db
            .prepare('SELECT * FROM announcements WHERE id < ? ORDER BY id DESC LIMIT ?')
            .all(cursor, limit);
    }
    return connection_1.db
        .prepare('SELECT * FROM announcements ORDER BY id DESC LIMIT ?')
        .all(limit);
}
function createAnnouncement(body) {
    const insert = connection_1.db.prepare('INSERT INTO announcements (body) VALUES (?)').run(body);
    return connection_1.db
        .prepare('SELECT * FROM announcements WHERE id = ?')
        .get(Number(insert.lastInsertRowid));
}
