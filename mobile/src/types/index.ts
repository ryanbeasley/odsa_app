export type Role = 'user' | 'admin';

export type User = {
  id: number;
  email: string;
  role: Role;
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
  seriesUuid: string | null;
  upcomingOccurrences?: {
    eventId: number;
    startAt: string;
    attendeeCount?: number;
    attending?: boolean;
  }[];
  recurrence: RecurrenceRule | null;
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
