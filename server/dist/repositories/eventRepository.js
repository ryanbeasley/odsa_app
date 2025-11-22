"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listEvents = listEvents;
exports.listUpcomingEvents = listUpcomingEvents;
exports.countAttendeesByEventIds = countAttendeesByEventIds;
exports.createEvent = createEvent;
exports.createEventSeries = createEventSeries;
exports.findEventById = findEventById;
exports.updateEvent = updateEvent;
exports.deleteEventsBySeries = deleteEventsBySeries;
exports.deleteEventById = deleteEventById;
exports.listEventsBySeries = listEventsBySeries;
exports.addEventAttendee = addEventAttendee;
exports.deleteEventAttendee = deleteEventAttendee;
exports.listUserEventIds = listUserEventIds;
const crypto_1 = require("crypto");
const connection_1 = require("../db/connection");
function listEvents() {
    return connection_1.db
        .prepare(`SELECT e.*, wg.name as working_group_name
       FROM events e
       LEFT JOIN working_groups wg ON wg.id = e.working_group_id
       ORDER BY e.start_at DESC, e.created_at DESC`)
        .all();
}
function listUpcomingEvents(nowIso) {
    return connection_1.db
        .prepare(`SELECT e.*, wg.name as working_group_name
       FROM events e
       LEFT JOIN working_groups wg ON wg.id = e.working_group_id
       WHERE e.end_at >= ?
       ORDER BY e.start_at ASC, e.created_at ASC`)
        .all(nowIso);
}
function countAttendeesByEventIds(eventIds) {
    if (!eventIds.length) {
        return {};
    }
    const placeholders = eventIds.map(() => '?').join(',');
    const stmt = connection_1.db.prepare(`SELECT event_id, COUNT(*) as count FROM event_attendees WHERE event_id IN (${placeholders}) GROUP BY event_id`);
    const rows = stmt.all(...eventIds);
    return rows.reduce((acc, row) => {
        acc[row.event_id] = row.count;
        return acc;
    }, {});
}
function createEvent(name, description, workingGroupId, startAt, endAt, location, seriesUuid, recurrence, seriesEndAt) {
    const insert = connection_1.db
        .prepare('INSERT INTO events (name, description, working_group_id, start_at, end_at, location, series_uuid, recurrence, series_end_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(name, description, workingGroupId, startAt, endAt, location, seriesUuid, recurrence, seriesEndAt);
    return connection_1.db
        .prepare('SELECT * FROM events WHERE id = ?')
        .get(Number(insert.lastInsertRowid));
}
function createEventSeries(payloads) {
    const seriesUuid = (0, crypto_1.randomUUID)();
    return payloads.map((payload) => createEvent(payload.name, payload.description, payload.workingGroupId, payload.startAt, payload.endAt, payload.location, seriesUuid, payload.recurrence, payload.seriesEndAt));
}
function findEventById(id) {
    return connection_1.db
        .prepare(`SELECT e.*, wg.name as working_group_name
       FROM events e
       LEFT JOIN working_groups wg ON wg.id = e.working_group_id
       WHERE e.id = ?`)
        .get(id);
}
function updateEvent(id, name, description, workingGroupId, startAt, endAt, location) {
    connection_1.db.prepare('UPDATE events SET name = ?, description = ?, working_group_id = ?, start_at = ?, end_at = ?, location = ? WHERE id = ?').run(name, description, workingGroupId, startAt, endAt, location, id);
    return findEventById(id);
}
function deleteEventsBySeries(seriesUuid) {
    connection_1.db.prepare('DELETE FROM events WHERE series_uuid = ?').run(seriesUuid);
}
function deleteEventById(id) {
    connection_1.db.prepare('DELETE FROM events WHERE id = ?').run(id);
}
function listEventsBySeries(seriesUuid) {
    return connection_1.db
        .prepare('SELECT * FROM events WHERE series_uuid = ? ORDER BY start_at ASC')
        .all(seriesUuid);
}
function addEventAttendee(userId, eventId) {
    connection_1.db.prepare('INSERT OR IGNORE INTO event_attendees (user_id, event_id) VALUES (?, ?)').run(userId, eventId);
    return connection_1.db
        .prepare('SELECT * FROM event_attendees WHERE user_id = ? AND event_id = ?')
        .get(userId, eventId);
}
function deleteEventAttendee(userId, eventId) {
    connection_1.db.prepare('DELETE FROM event_attendees WHERE user_id = ? AND event_id = ?').run(userId, eventId);
}
function listUserEventIds(userId) {
    return connection_1.db
        .prepare('SELECT event_id FROM event_attendees WHERE user_id = ?')
        .all(userId)
        .map((row) => row.event_id);
}
