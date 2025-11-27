"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertWebPushSubscription = upsertWebPushSubscription;
exports.deleteWebPushSubscription = deleteWebPushSubscription;
exports.listWebPushSubscriptions = listWebPushSubscriptions;
exports.findWebPushSubscriptionByEndpoint = findWebPushSubscriptionByEndpoint;
const connection_1 = require("../db/connection");
function upsertWebPushSubscription(userId, endpoint, p256dh, auth) {
    const existing = connection_1.db
        .prepare('SELECT * FROM web_push_subscriptions WHERE endpoint = ?')
        .get(endpoint);
    if (existing) {
        connection_1.db.prepare('UPDATE web_push_subscriptions SET user_id = ?, p256dh = ?, auth = ? WHERE id = ?').run(userId, p256dh, auth, existing.id);
    }
    else {
        connection_1.db.prepare('INSERT INTO web_push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)').run(userId, endpoint, p256dh, auth);
    }
    return connection_1.db
        .prepare('SELECT * FROM web_push_subscriptions WHERE endpoint = ?')
        .get(endpoint);
}
function deleteWebPushSubscription(endpoint) {
    connection_1.db.prepare('DELETE FROM web_push_subscriptions WHERE endpoint = ?').run(endpoint);
}
function listWebPushSubscriptions() {
    return connection_1.db.prepare('SELECT * FROM web_push_subscriptions').all();
}
function findWebPushSubscriptionByEndpoint(endpoint) {
    return connection_1.db.prepare('SELECT * FROM web_push_subscriptions WHERE endpoint = ?').get(endpoint);
}
