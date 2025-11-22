"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findPushSubscriptionByUserId = findPushSubscriptionByUserId;
exports.upsertPushSubscription = upsertPushSubscription;
exports.deletePushSubscription = deletePushSubscription;
exports.listPushSubscriptions = listPushSubscriptions;
exports.listEventAlertCandidates = listEventAlertCandidates;
const connection_1 = require("../db/connection");
function findPushSubscriptionByUserId(userId) {
    return connection_1.db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').get(userId);
}
function upsertPushSubscription(userId, token, options) {
    const existing = findPushSubscriptionByUserId(userId);
    const announcementEnabled = typeof options?.announcementAlertsEnabled === 'boolean'
        ? Number(options.announcementAlertsEnabled)
        : existing?.announcement_alerts_enabled ?? 1;
    const eventEnabled = typeof options?.eventAlertsEnabled === 'boolean'
        ? Number(options.eventAlertsEnabled)
        : existing?.event_alerts_enabled ?? 0;
    connection_1.db.prepare(`INSERT INTO push_subscriptions (user_id, token, announcement_alerts_enabled, event_alerts_enabled)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
      token = excluded.token,
      announcement_alerts_enabled = excluded.announcement_alerts_enabled,
      event_alerts_enabled = excluded.event_alerts_enabled`).run(userId, token, announcementEnabled, eventEnabled);
    return connection_1.db
        .prepare('SELECT * FROM push_subscriptions WHERE user_id = ?')
        .get(userId);
}
function deletePushSubscription(userId) {
    connection_1.db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(userId);
}
function listPushSubscriptions() {
    return connection_1.db.prepare('SELECT * FROM push_subscriptions').all();
}
function listEventAlertCandidates(hoursAhead = 24) {
    const clampedHours = Math.max(1, hoursAhead);
    const window = `+${clampedHours} hours`;
    return connection_1.db
        .prepare(`SELECT
        e.id as event_id,
        e.name as event_name,
        e.start_at as start_at,
        ea.user_id as user_id,
        ps.token as token
      FROM event_attendees ea
      INNER JOIN events e ON e.id = ea.event_id
      INNER JOIN push_subscriptions ps ON ps.user_id = ea.user_id
      WHERE ps.event_alerts_enabled = 1
        AND e.start_at IS NOT NULL
        AND datetime(e.start_at) >= datetime('now')
        AND datetime(e.start_at) <= datetime('now', ?)`)
        .all(window);
}
