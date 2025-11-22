import {
  AnnouncementRow,
  EventRow,
  PushSubscriptionRow,
  SupportLinkRow,
  UserRow,
  WebPushSubscriptionRow,
  WorkingGroupRow,
} from '../types';

export function toPublicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.first_name ?? null,
    lastName: user.last_name ?? null,
    phone: user.phone ?? null,
  };
}

export function serializeAnnouncement(row: AnnouncementRow) {
  return {
    id: row.id,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function serializeSupportLink(row: SupportLinkRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    link: row.link,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function serializeWorkingGroup(row: WorkingGroupRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    members: row.members,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

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
    seriesUuid: row.series_uuid ?? null,
    recurrence: row.recurrence ?? null,
    seriesEndAt: row.series_end_at ?? null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function serializePushSubscription(row: PushSubscriptionRow) {
  return {
    token: row.token,
    createdAt: new Date(row.created_at).toISOString(),
    announcementAlertsEnabled: Boolean(row.announcement_alerts_enabled),
    eventAlertsEnabled: Boolean(row.event_alerts_enabled),
  };
}

export function serializeWebPushSubscription(row: WebPushSubscriptionRow) {
  return {
    endpoint: row.endpoint,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
