import { db } from '../db/connection';
import { EventNotificationType } from '../types';

/**
 * Checks whether a notification log entry already exists for the given event/user/type.
 */
export function hasEventNotificationLog(
  eventId: number,
  userId: number,
  notificationType: EventNotificationType
): boolean {
  console.log();
  const existing = db
    .prepare<[number, number, string]>('SELECT 1 FROM event_notification_logs WHERE event_id = ? AND user_id = ? AND notification_type = ?')
    .get(eventId, userId, notificationType);
  return Boolean(existing);
}

/**
 * Inserts a notification log entry if it does not already exist.
 */
export function recordEventNotificationLog(
  eventId: number,
  userId: number,
  notificationType: EventNotificationType
): void {
  console.log();
  db.prepare<[number, number, string]>(
    'INSERT OR IGNORE INTO event_notification_logs (event_id, user_id, notification_type) VALUES (?, ?, ?)'
  ).run(eventId, userId, notificationType);
}
