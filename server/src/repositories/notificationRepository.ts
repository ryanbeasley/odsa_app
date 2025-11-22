import { db } from '../db/connection';
import { EventNotificationType } from '../types';

export function hasEventNotificationLog(
  eventId: number,
  userId: number,
  notificationType: EventNotificationType
): boolean {
  const existing = db
    .prepare<[number, number, string]>('SELECT 1 FROM event_notification_logs WHERE event_id = ? AND user_id = ? AND notification_type = ?')
    .get(eventId, userId, notificationType);
  return Boolean(existing);
}

export function recordEventNotificationLog(
  eventId: number,
  userId: number,
  notificationType: EventNotificationType
): void {
  db.prepare<[number, number, string]>(
    'INSERT OR IGNORE INTO event_notification_logs (event_id, user_id, notification_type) VALUES (?, ?, ?)'
  ).run(eventId, userId, notificationType);
}
