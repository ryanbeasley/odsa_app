import { db } from '../db/connection';
import { WebPushSubscriptionRow } from '../types';

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
  return db.prepare<[], WebPushSubscriptionRow>('SELECT * FROM web_push_subscriptions').all();
}

export function findWebPushSubscriptionByEndpoint(endpoint: string): WebPushSubscriptionRow | undefined {
  return db.prepare<[string], WebPushSubscriptionRow>('SELECT * FROM web_push_subscriptions WHERE endpoint = ?').get(endpoint);
}
