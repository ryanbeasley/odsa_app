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
  discord_event_id: string | null;
  series_uuid: string | null;
  recurrence_rule: string | null;
  series_end_at: string | null;
  created_at: string;
};

export type EventPayload = {
  name: string;
  description: string;
  workingGroupId: number;
  startAt: string;
  endAt: string;
  location: string;
  locationDisplayName?: string | null;
  createDiscordEvent?: boolean;
  recurrenceRule?: {
    frequency?: number;
    interval?: number | null;
    by_weekday?: number[] | null;
    by_n_weekday?: Array<{ n: number; day: number }> | null;
    by_month_day?: number[] | null;
  } | null;
  seriesEndAt?: string | null;
};

export type NormalizedRecurrence = {
  recurrence: RecurrenceRule;
  monthlyPattern: MonthlyPattern;
  rule: {
    start: string;
    frequency: number;
    interval?: number | null;
    by_weekday?: number[] | null;
    by_n_weekday?: Array<{ n: number; day: number }> | null;
    by_month_day?: number[] | null;
  } | null;
  dailyWeekdays: number[] | null;
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

export type EventAlertSmsCandidateRow = {
  event_id: number;
  event_name: string;
  start_at: string;
  user_id: number;
  phone: string;
};

export type EventNotificationType = 'day-of' | 'hour-before' | 'sms-day-of' | 'sms-hour-before';

export interface UserRow {
  id: number;
  password_hash: string;
  role: Role;
  username: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  event_alerts_sms_enabled: number;
}

export type RecurrenceRule = 'none' | 'daily' | 'weekly' | 'monthly';
export type MonthlyPattern = 'date' | 'weekday';
