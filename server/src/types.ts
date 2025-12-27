export type Role = 'user' | 'admin';

export type AnnouncementRow = {
  id: number;
  body: string;
  created_at: string;
};

export type SupportLinkRow = {
  id: number;
  title: string;
  description: string;
  link: string;
  position: number;
  created_at: string;
};

export type PushSubscriptionRow = {
  user_id: number;
  token: string;
  announcement_alerts_enabled: number;
  event_alerts_enabled: number;
  created_at: string;
};

export type WebPushSubscriptionRow = {
  id: number;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};

export type WorkingGroupRow = {
  id: number;
  name: string;
  description: string;
  members: string;
  created_at: string;
};

export type EventRow = {
  id: number;
  name: string;
  description: string;
  working_group_id: number;
  working_group_name?: string;
  start_at: string;
  end_at: string;
  location: string;
  location_display_name: string | null;
  series_uuid: string | null;
  recurrence: string | null;
  series_end_at: string | null;
  created_at: string;
};

export type EventAttendeeRow = {
  user_id: number;
  event_id: number;
  created_at: string;
};

export type EventAlertCandidateRow = {
  event_id: number;
  event_name: string;
  start_at: string;
  user_id: number;
  token: string;
};

export type EventNotificationType = 'day-of' | 'hour-before';

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  role: Role;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

export type RecurrenceRule = 'none' | 'daily' | 'weekly' | 'monthly';
export type MonthlyPattern = 'date' | 'weekday';
