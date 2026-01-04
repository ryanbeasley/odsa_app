import webPush from 'web-push';
import { EXPO_PUSH_TOKEN, EVENT_ALERT_HOUR_MS, EVENT_ALERT_INTERVAL_MS, EVENT_ALERT_LOOKAHEAD_HOURS, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY } from '../config/env';
import { listPushSubscriptions } from '../repositories/pushSubscriptionRepository';
import { listWebPushSubscriptions } from '../repositories/webPushRepository';
import { listEventAlertCandidates } from '../repositories/pushSubscriptionRepository';
import { hasEventNotificationLog, recordEventNotificationLog } from '../repositories/notificationRepository';
import { runWithLogContext, DEFAULT_LOG_PATH, buildLogContext } from '../utils/logContext';

type ExpoPushMessage = { to: string; title: string; body: string };

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails('mailto:push@odsa.local', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

/**
 * Sends a batch of Expo push notifications in chunks.
 */
export async function dispatchExpoPushMessages(messages: ExpoPushMessage[]) {
  if (!EXPO_PUSH_TOKEN || !messages.length) {
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
          Authorization: `Bearer ${EXPO_PUSH_TOKEN}`,
        },
        body: JSON.stringify(batch),
      });
      console.debug(`Dispatched ${batch.length} push notifications`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to send push notifications', err);
    }
  }
  console.log(`Dispatched total of ${messages.length} push notifications`);
}

/**
 * Sends announcement notifications via native and web push.
 */
export async function sendAnnouncementPush(body: string) {
  console.logEnter();
  const subscribers = listPushSubscriptions().filter((row) => row.announcement_alerts_enabled);
  const messages = subscribers.map((row) => ({
    to: row.token,
    title: 'New announcement',
    body,
  }));
  await dispatchExpoPushMessages(messages);

  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    const webSubs = listWebPushSubscriptions();
    const payload = JSON.stringify({ title: 'New announcement', body });
    for (const sub of webSubs) {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to send web push', err);
      }
    }
  }
}

/**
 * Generates and sends event reminders for upcoming attendee events.
 */
export async function processEventAlertNotifications() {
  console.logEnter();
  if (!EXPO_PUSH_TOKEN) {
    return;
  }
  const now = new Date();
  const candidates = listEventAlertCandidates(EVENT_ALERT_LOOKAHEAD_HOURS);
  const lookaheadMs = EVENT_ALERT_LOOKAHEAD_HOURS * 60 * 60 * 1000;
  const messages: ExpoPushMessage[] = [];
  for (const candidate of candidates) {
    const startAt = new Date(candidate.start_at);
    if (Number.isNaN(startAt.getTime())) {
      continue;
    }
    const diffMs = startAt.getTime() - now.getTime();
    if (diffMs <= 0) {
      continue;
    }

    if (diffMs <= lookaheadMs && !hasEventNotificationLog(candidate.event_id, candidate.user_id, 'day-of')) {
      recordEventNotificationLog(candidate.event_id, candidate.user_id, 'day-of');
      messages.push({
        to: candidate.token,
        title: 'Event reminder',
        body: `Reminder: ${candidate.event_name} is happening within the next 24 hours.`,
      });
    }

    if (diffMs <= EVENT_ALERT_HOUR_MS && !hasEventNotificationLog(candidate.event_id, candidate.user_id, 'hour-before')) {
      recordEventNotificationLog(candidate.event_id, candidate.user_id, 'hour-before');
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

let eventAlertTimer: NodeJS.Timeout | null = null;

/**
 * Starts a timer that periodically processes event alerts.
 */
/* v8 ignore start */
export function startEventAlertScheduler() {
  if (eventAlertTimer) {
    return;
  }

  const runner = () => {
    const context = buildLogContext(
      'system',
      'event-alerts',
      process.env.LOG_FILE_PATH ?? DEFAULT_LOG_PATH,
      process.env.LOG_LEVEL ?? 'info'
    );
    if (context === null) {
      processEventAlertNotifications().catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to process event alerts', err);
      });
      return;
    }
    runWithLogContext(context, () => {
      void processEventAlertNotifications().catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to process event alerts', err);
      });
    });
  };

  runner();
  eventAlertTimer = setInterval(runner, EVENT_ALERT_INTERVAL_MS);
}
/* v8 ignore stop */
