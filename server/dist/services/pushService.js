"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchExpoPushMessages = dispatchExpoPushMessages;
exports.sendAnnouncementPush = sendAnnouncementPush;
exports.processEventAlertNotifications = processEventAlertNotifications;
exports.startEventAlertScheduler = startEventAlertScheduler;
const web_push_1 = __importDefault(require("web-push"));
const env_1 = require("../config/env");
const pushSubscriptionRepository_1 = require("../repositories/pushSubscriptionRepository");
const webPushRepository_1 = require("../repositories/webPushRepository");
const pushSubscriptionRepository_2 = require("../repositories/pushSubscriptionRepository");
const notificationRepository_1 = require("../repositories/notificationRepository");
if (env_1.VAPID_PUBLIC_KEY && env_1.VAPID_PRIVATE_KEY) {
    web_push_1.default.setVapidDetails('mailto:push@odsa.local', env_1.VAPID_PUBLIC_KEY, env_1.VAPID_PRIVATE_KEY);
}
async function dispatchExpoPushMessages(messages) {
    if (!env_1.EXPO_PUSH_TOKEN || !messages.length) {
        return;
    }
    const chunkSize = 50;
    for (let i = 0; i < messages.length; i += chunkSize) {
        const batch = messages.slice(i, i + chunkSize);
        try {
            await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${env_1.EXPO_PUSH_TOKEN}`,
                },
                body: JSON.stringify(batch),
            });
        }
        catch (err) {
            // eslint-disable-next-line no-console
            console.error('Failed to send push notifications', err);
        }
    }
}
async function sendAnnouncementPush(body) {
    const subscribers = (0, pushSubscriptionRepository_1.listPushSubscriptions)().filter((row) => row.announcement_alerts_enabled);
    const messages = subscribers.map((row) => ({
        to: row.token,
        title: 'New announcement',
        body,
    }));
    await dispatchExpoPushMessages(messages);
    if (env_1.VAPID_PUBLIC_KEY && env_1.VAPID_PRIVATE_KEY) {
        const webSubs = (0, webPushRepository_1.listWebPushSubscriptions)();
        const payload = JSON.stringify({ title: 'New announcement', body });
        for (const sub of webSubs) {
            try {
                await web_push_1.default.sendNotification({
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth },
                }, payload);
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.error('Failed to send web push', err);
            }
        }
    }
}
function isSameUtcDay(a, b) {
    return (a.getUTCFullYear() === b.getUTCFullYear() &&
        a.getUTCMonth() === b.getUTCMonth() &&
        a.getUTCDate() === b.getUTCDate());
}
async function processEventAlertNotifications() {
    if (!env_1.EXPO_PUSH_TOKEN) {
        return;
    }
    const now = new Date();
    const candidates = (0, pushSubscriptionRepository_2.listEventAlertCandidates)(env_1.EVENT_ALERT_LOOKAHEAD_HOURS);
    const messages = [];
    for (const candidate of candidates) {
        const startAt = new Date(candidate.start_at);
        if (Number.isNaN(startAt.getTime())) {
            continue;
        }
        const diffMs = startAt.getTime() - now.getTime();
        if (diffMs <= 0) {
            continue;
        }
        if (isSameUtcDay(startAt, now) && !(0, notificationRepository_1.hasEventNotificationLog)(candidate.event_id, candidate.user_id, 'day-of')) {
            (0, notificationRepository_1.recordEventNotificationLog)(candidate.event_id, candidate.user_id, 'day-of');
            messages.push({
                to: candidate.token,
                title: 'Event reminder',
                body: `Reminder: ${candidate.event_name} is happening today.`,
            });
        }
        if (diffMs <= env_1.EVENT_ALERT_HOUR_MS && !(0, notificationRepository_1.hasEventNotificationLog)(candidate.event_id, candidate.user_id, 'hour-before')) {
            (0, notificationRepository_1.recordEventNotificationLog)(candidate.event_id, candidate.user_id, 'hour-before');
            messages.push({
                to: candidate.token,
                title: 'Event reminder',
                body: 'You have an event happening today!',
            });
        }
    }
    if (messages.length) {
        await dispatchExpoPushMessages(messages);
    }
}
let eventAlertTimer = null;
function startEventAlertScheduler() {
    if (eventAlertTimer) {
        return;
    }
    const runner = () => {
        void processEventAlertNotifications().catch((err) => {
            // eslint-disable-next-line no-console
            console.error('Failed to process event alerts', err);
        });
    };
    runner();
    eventAlertTimer = setInterval(runner, env_1.EVENT_ALERT_INTERVAL_MS);
}
