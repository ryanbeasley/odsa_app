import { db } from '../db/connection';
import { WebPushSubscriptionRow } from '../types';

/**
 * Inserts or updates a web push subscription for the given endpoint.
 */
export function upsertWebPushSubscription(
  userId: number,
  endpoint: string,
  p256dh: string,
  auth: string
): WebPushSubscriptionRow {
  console.logEnter();
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

/**
 * Removes a web push subscription by endpoint.
 */
export function deleteWebPushSubscription(endpoint: string): void {
  console.logEnter();
  db.prepare<[string]>('DELETE FROM web_push_subscriptions WHERE endpoint = ?').run(endpoint);
}

/**
 * Lists all stored web push subscriptions.
 */
export function listWebPushSubscriptions(): WebPushSubscriptionRow[] {
  console.logEnter();
  return db.prepare<[], WebPushSubscriptionRow>('SELECT * FROM web_push_subscriptions').all();
}

/**
 * Looks up a subscription by endpoint.
 */
export function findWebPushSubscriptionByEndpoint(endpoint: string): WebPushSubscriptionRow | undefined {
  console.logEnter();
  return db.prepare<[string], WebPushSubscriptionRow>('SELECT * FROM web_push_subscriptions WHERE endpoint = ?').get(endpoint);
}
