export type Role = 'user' | 'admin';

export type User = {
  id: number;
  email: string;
  role: Role;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  eventAlertsSmsEnabled: boolean;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type Announcement = {
  id: number;
  body: string;
  createdAt: string;
};

export type AnnouncementsResponse = {
  announcements: Announcement[];
  nextCursor: number | null;
};

export type AnnouncementCreateResponse = {
  announcement: Announcement;
};

export type SupportLink = {
  id: number;
  title: string;
  description: string;
  link: string;
  createdAt: string;
};

export type SupportLinksResponse = {
  links: SupportLink[];
};

export type SupportLinkMutationResponse = {
  link: SupportLink;
};

export type PushSubscriptionStatusResponse = {
  subscription: {
    token: string;
    createdAt: string;
    announcementAlertsEnabled: boolean;
    eventAlertsEnabled: boolean;
  } | null;
};

export type WorkingGroup = {
  id: number;
  name: string;
  description: string;
  members: string;
  createdAt: string;
};

export type WorkingGroupsResponse = {
  groups: WorkingGroup[];
};

export type WorkingGroupCreateResponse = {
  group: WorkingGroup;
};

export type Event = {
  id: number;
  name: string;
  description: string;
  workingGroupId: number;
  workingGroupName: string | null;
  startAt: string;
  endAt: string;
  location: string;
  locationDisplayName: string | null;
  discordEventId?: string | null;
  seriesUuid: string | null;
  upcomingOccurrences?: {
    eventId: number;
    startAt: string;
    attendeeCount?: number;
    attending?: boolean;
  }[];
  recurrenceRule: DiscordRecurrenceRule | null;
  seriesEndAt: string | null;
  attending?: boolean;
  attendeeCount?: number;
  createdAt: string;
};

export type EventsResponse = {
  events: Event[];
};

export type EventCreateResponse = {
  event: Event;
};

export type RecurrenceRule = 'none' | 'daily' | 'weekly' | 'monthly';

export enum DiscordRecurrenceFrequency {
  YEARLY = 0,
  MONTHLY = 1,
  WEEKLY = 2,
  DAILY = 3,
}

export enum DiscordWeekday {
  MONDAY = 0,
  TUESDAY = 1,
  WEDNESDAY = 2,
  THURSDAY = 3,
  FRIDAY = 4,
  SATURDAY = 5,
  SUNDAY = 6,
}

export type DiscordRecurrenceRule = {
  start: string;
  frequency: number;
  interval?: number | null;
  by_weekday?: number[] | null;
  by_n_weekday?: Array<{ n: number; day: number }> | null;
  by_month_day?: number[] | null;
};

export type DiscordRecurrenceRuleInput = {
  frequency?: number;
  interval?: number | null;
  by_weekday?: number[] | null;
  by_n_weekday?: Array<{ n: number; day: number }> | null;
  by_month_day?: number[] | null;
};

export type UsersResponse = {
  users: User[];
};
