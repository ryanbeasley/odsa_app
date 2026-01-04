import {
  AnnouncementRow,
  EventRow,
  PushSubscriptionRow,
  SupportLinkRow,
  UserRow,
  WebPushSubscriptionRow,
  WorkingGroupRow,
} from '../types';

/**
 * Converts a database user row into the public API shape.
 */
export function toPublicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.first_name ?? null,
    lastName: user.last_name ?? null,
    phone: user.phone ?? null,
    eventAlertsSmsEnabled: Boolean(user.event_alerts_sms_enabled),
  };
}

/**
 * Converts an announcement row to API format.
 */
export function serializeAnnouncement(row: AnnouncementRow) {
  return {
    id: row.id,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * Converts a support link row to API format.
 */
export function serializeSupportLink(row: SupportLinkRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    link: row.link,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * Converts a working group row to API format.
 */
export function serializeWorkingGroup(row: WorkingGroupRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    members: row.members,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * Converts an event row (with optional working group name) to API format.
 */
export function serializeEvent(row: EventRow & { working_group_name?: string }) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    workingGroupId: row.working_group_id,
    workingGroupName: row.working_group_name ?? null,
    startAt: row.start_at,
    endAt: row.end_at,
    location: row.location,
    locationDisplayName: row.location_display_name ?? null,
    discordEventId: row.discord_event_id ?? null,
    seriesUuid: row.series_uuid ?? null,
    recurrenceRule: parseRecurrenceRule(row.recurrence_rule),
    seriesEndAt: row.series_end_at ?? null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function parseRecurrenceRule(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Converts a push subscription row to API format.
 */
export function serializePushSubscription(row: PushSubscriptionRow) {
  return {
    token: row.token,
    createdAt: new Date(row.created_at).toISOString(),
    announcementAlertsEnabled: Boolean(row.announcement_alerts_enabled),
    eventAlertsEnabled: Boolean(row.event_alerts_enabled),
  };
}

/**
 * Converts a web push subscription row to API format.
 */
export function serializeWebPushSubscription(row: WebPushSubscriptionRow) {
  return {
    endpoint: row.endpoint,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
