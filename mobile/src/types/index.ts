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
