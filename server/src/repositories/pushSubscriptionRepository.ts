import { db } from '../db/connection';
import { EventAlertCandidateRow, PushSubscriptionRow } from '../types';

/**
 * Looks up a push subscription by user ID.
 */
export function findPushSubscriptionByUserId(userId: number): PushSubscriptionRow | undefined {
  return db.prepare<[number], PushSubscriptionRow>('SELECT * FROM push_subscriptions WHERE user_id = ?').get(userId);
}

/**
 * Inserts or updates a push subscription for a user, returning the row.
 */
export function upsertPushSubscription(
  userId: number,
  token: string,
  options?: { announcementAlertsEnabled?: boolean; eventAlertsEnabled?: boolean }
): PushSubscriptionRow {
  const existing = findPushSubscriptionByUserId(userId);
  const announcementEnabled =
    typeof options?.announcementAlertsEnabled === 'boolean'
      ? Number(options.announcementAlertsEnabled)
      : existing?.announcement_alerts_enabled ?? 1;
  const eventEnabled =
    typeof options?.eventAlertsEnabled === 'boolean'
      ? Number(options.eventAlertsEnabled)
      : existing?.event_alerts_enabled ?? 0;

  db.prepare<[number, string, number, number]>(
    `INSERT INTO push_subscriptions (user_id, token, announcement_alerts_enabled, event_alerts_enabled)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
      token = excluded.token,
      announcement_alerts_enabled = excluded.announcement_alerts_enabled,
      event_alerts_enabled = excluded.event_alerts_enabled`
  ).run(userId, token, announcementEnabled, eventEnabled);

  return db
    .prepare<[number], PushSubscriptionRow>('SELECT * FROM push_subscriptions WHERE user_id = ?')
    .get(userId) as PushSubscriptionRow;
}

/**
 * Removes a push subscription for the given user.
 */
export function deletePushSubscription(userId: number): void {
  db.prepare<[number]>('DELETE FROM push_subscriptions WHERE user_id = ?').run(userId);
}

/**
 * Returns all push subscriptions.
 */
export function listPushSubscriptions(): PushSubscriptionRow[] {
  return db.prepare<[], PushSubscriptionRow>('SELECT * FROM push_subscriptions').all();
}

/**
 * Lists attendees whose events start within the specified window.
 */
export function listEventAlertCandidates(hoursAhead = 24): EventAlertCandidateRow[] {
  const clampedHours = Math.max(1, hoursAhead);
  const window = `+${clampedHours} hours`;
  return db
    .prepare<[string], EventAlertCandidateRow>(
      `SELECT
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
        AND datetime(e.start_at) <= datetime('now', ?)`
    )
    .all(window);
}
