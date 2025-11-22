"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasEventNotificationLog = hasEventNotificationLog;
exports.recordEventNotificationLog = recordEventNotificationLog;
const connection_1 = require("../db/connection");
function hasEventNotificationLog(eventId, userId, notificationType) {
    const existing = connection_1.db
        .prepare('SELECT 1 FROM event_notification_logs WHERE event_id = ? AND user_id = ? AND notification_type = ?')
        .get(eventId, userId, notificationType);
    return Boolean(existing);
}
function recordEventNotificationLog(eventId, userId, notificationType) {
    connection_1.db.prepare('INSERT OR IGNORE INTO event_notification_logs (event_id, user_id, notification_type) VALUES (?, ?, ?)').run(eventId, userId, notificationType);
}
