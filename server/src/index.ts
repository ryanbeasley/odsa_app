import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import webPush from 'web-push';
import {
  createAnnouncement,
  createUser,
  findUserByEmail,
  findUserById,
  listAnnouncements,
  Role,
  AnnouncementRow,
  SupportLinkRow,
  listSupportLinks,
  createSupportLink,
  updateSupportLink,
  deleteSupportLink,
  reorderSupportLinks,
  upsertPushSubscription,
  deletePushSubscription,
  findPushSubscriptionByUserId,
  listPushSubscriptions,
  upsertWebPushSubscription,
  deleteWebPushSubscription,
  listWebPushSubscriptions,
  findWebPushSubscriptionByEndpoint,
  PushSubscriptionRow,
  WebPushSubscriptionRow,
  WorkingGroupRow,
  listWorkingGroups,
  createWorkingGroup,
  updateWorkingGroup,
  EventRow,
  listEvents,
  createEvent,
  findWorkingGroupById,
  listUpcomingEvents,
  updateEvent,
  findEventById,
  deleteEventsBySeries,
  deleteEventById,
  addEventAttendee,
  deleteEventAttendee,
  listUserEventIds,
  listEventsBySeries,
  countAttendeesByEventIds,
  listEventAlertCandidates,
  recordEventNotificationLog,
  hasEventNotificationLog,
  listUsers,
  updateUserProfile,
  updateUserRole,
} from './db';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';
const TOKEN_EXPIRY = process.env.JWT_EXPIRY ?? '7d';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const EXPO_PUSH_TOKEN = process.env.EXPO_PUSH_ACCESS_TOKEN;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const EVENT_ALERT_INTERVAL_MS = Number(process.env.EVENT_ALERT_INTERVAL_MS ?? 5 * 60 * 1000);
const EVENT_ALERT_LOOKAHEAD_HOURS = Number(process.env.EVENT_ALERT_LOOKAHEAD_HOURS ?? 24);
const EVENT_ALERT_HOUR_MS = 60 * 60 * 1000;
let eventAlertTimer: NodeJS.Timeout | null = null;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails('mailto:push@odsa.local', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

type RequestUser = {
  id: number;
  email: string;
  role: Role;
};

interface AuthedRequest extends Request {
  user?: RequestUser;
}

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

function toPublicUser(user: {
  id: number;
  email: string;
  role: Role;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.first_name ?? null,
    lastName: user.last_name ?? null,
    phone: user.phone ?? null,
  };
}

function signToken(user: { id: number; email: string; role: Role }) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & {
      sub: string;
      role: Role;
      email: string;
    };
    const user = findUserById(Number(payload.sub));
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

app.post('/api/signup', (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'email is required' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (findUserByEmail(normalizedEmail)) {
    return res.status(409).json({ error: 'email already registered' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const user = createUser(normalizedEmail, passwordHash, 'user');
  const token = signToken(user);
  res.status(201).json({ token, user: toPublicUser(user) });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const user = findUserByEmail(normalizedEmail);
  if (!user) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const token = signToken(user);
  res.json({ token, user: toPublicUser(user) });
});

app.post('/api/oauth/google', async (req, res) => {
  if (!googleClient || !GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: 'Google OAuth is not configured' });
  }

  const { idToken } = req.body ?? {};
  if (typeof idToken !== 'string' || !idToken.trim()) {
    return res.status(400).json({ error: 'idToken is required' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || payload.email_verified === false) {
      return res.status(401).json({ error: 'Google account not verified' });
    }

    const normalizedEmail = payload.email.toLowerCase();
    let user = findUserByEmail(normalizedEmail);
    if (!user) {
      const randomSecret = crypto.randomBytes(32).toString('hex');
      const passwordHash = bcrypt.hashSync(randomSecret, 10);
      user = createUser(normalizedEmail, passwordHash, 'user');
    }

    const token = signToken(user);
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid Google token' });
  }
});

app.patch('/api/profile', authenticate, (req: AuthedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { firstName, lastName, phone, email } = req.body ?? {};

  const updates: { first_name?: string | null; last_name?: string | null; phone?: string | null; email?: string } = {};
  if (firstName !== undefined) {
    if (firstName !== null && typeof firstName !== 'string') {
      return res.status(400).json({ error: 'firstName must be a string' });
    }
    updates.first_name = firstName?.trim() ? firstName.trim() : null;
  }
  if (lastName !== undefined) {
    if (lastName !== null && typeof lastName !== 'string') {
      return res.status(400).json({ error: 'lastName must be a string' });
    }
    updates.last_name = lastName?.trim() ? lastName.trim() : null;
  }
  if (phone !== undefined) {
    if (phone !== null && typeof phone !== 'string') {
      return res.status(400).json({ error: 'phone must be a string' });
    }
    updates.phone = phone?.trim() ? phone.trim() : null;
  }
  if (email !== undefined) {
    if (email !== null && typeof email !== 'string') {
      return res.status(400).json({ error: 'email must be a string' });
    }
    const normalizedEmail = email?.trim().toLowerCase() ?? null;
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'email is invalid' });
    }
    if (normalizedEmail && normalizedEmail !== req.user.email && findUserByEmail(normalizedEmail)) {
      return res.status(409).json({ error: 'email already registered' });
    }
    if (normalizedEmail) {
      updates.email = normalizedEmail;
    }
  }

  const updated = updateUserProfile(req.user.id, updates);
  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }
  const token = signToken(updated);
  return res.json({ token, user: toPublicUser(updated) });
});

app.get('/api/users', authenticate, requireAdmin, (req: AuthedRequest, res: Response) => {
  const queryParam = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
  const users = listUsers(typeof queryParam === 'string' ? queryParam : undefined).map(toPublicUser);
  return res.json({ users });
});

app.patch('/api/users/:id/role', authenticate, requireAdmin, (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  if (req.user?.id === id) {
    return res.status(400).json({ error: 'You cannot change your own role' });
  }
  const { role } = req.body ?? {};
  if (role !== 'user' && role !== 'admin') {
    return res.status(400).json({ error: 'role must be user or admin' });
  }
  const updated = updateUserRole(id, role);
  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({ user: toPublicUser(updated) });
});

function serializeAnnouncement(row: AnnouncementRow) {
  return {
    id: row.id,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function serializePushSubscription(row: PushSubscriptionRow) {
  return {
    token: row.token,
    createdAt: new Date(row.created_at).toISOString(),
    announcementAlertsEnabled: Boolean(row.announcement_alerts_enabled),
    eventAlertsEnabled: Boolean(row.event_alerts_enabled),
  };
}

function serializeWebPushSubscription(row: WebPushSubscriptionRow) {
  return {
    endpoint: row.endpoint,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function serializeWorkingGroup(row: WorkingGroupRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    members: row.members,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function serializeEvent(row: EventRow & { working_group_name?: string }) {
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

function parseLimit(value: unknown, fallback = 5) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(20, Math.max(1, Math.floor(parsed)));
}

function handleGetAnnouncements(req: Request, res: Response) {
  const limit = parseLimit(req.query.limit);
  const cursorParam = Array.isArray(req.query.cursor) ? req.query.cursor[0] : req.query.cursor;
  const cursor = cursorParam ? Number(cursorParam) : undefined;
  if (cursorParam && (!cursor || cursor <= 0)) {
    return res.status(400).json({ error: 'cursor must be a positive number' });
  }

  const rows = listAnnouncements(limit, cursor);
  const announcements = rows.map(serializeAnnouncement);
  const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

  res.json({ announcements, nextCursor });
}

async function handleCreateAnnouncement(req: AuthedRequest, res: Response) {
  const { message } = req.body ?? {};
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message must be a non-empty string' });
  }
  const announcement = createAnnouncement(message.trim());
  void sendAnnouncementPush(announcement.body);
  res.status(201).json({ announcement: serializeAnnouncement(announcement) });
}

app.get('/api/announcements', authenticate, handleGetAnnouncements);
app.get('/api/hello', authenticate, handleGetAnnouncements);

app.post('/api/announcements', authenticate, requireAdmin, handleCreateAnnouncement);
app.post('/api/hello', authenticate, requireAdmin, handleCreateAnnouncement);

function serializeSupportLink(row: SupportLinkRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    link: row.link,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

app.get('/api/support-links', authenticate, (_req, res) => {
  const links = listSupportLinks().map(serializeSupportLink);
  res.json({ links });
});

function validateSupportLinkBody(body: unknown) {
  const { title, description, link } = (body ?? {}) as Record<string, unknown>;
  if (typeof title !== 'string' || !title.trim()) {
    return 'title is required';
  }
  if (typeof description !== 'string' || !description.trim()) {
    return 'description is required';
  }
  if (typeof link !== 'string' || !link.trim()) {
    return 'link is required';
  }
  return null;
}

app.post('/api/support-links', authenticate, requireAdmin, (req, res) => {
  const error = validateSupportLinkBody(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const { title, description, link } = req.body as {
    title: string;
    description: string;
    link: string;
  };
  const created = createSupportLink(title.trim(), description.trim(), link.trim());
  return res.status(201).json({ link: serializeSupportLink(created) });
});

app.patch('/api/support-links/reorder', authenticate, requireAdmin, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  if (!ids?.length || !ids.every((value: unknown) => Number.isFinite(Number(value)))) {
    return res.status(400).json({ error: 'ids must be an array of numbers' });
  }
  const parsedIds = ids.map((value: unknown) => Number(value));
  const uniqueIds = new Set(parsedIds);
  if (uniqueIds.size !== parsedIds.length) {
    return res.status(400).json({ error: 'ids must be unique' });
  }

  const existingIds = listSupportLinks().map((link) => link.id);
  const missingIds = parsedIds.filter((id: number) => !existingIds.includes(id));
  if (missingIds.length) {
    return res.status(400).json({ error: 'ids must match existing support links' });
  }

  const fullOrder = [
    ...parsedIds,
    ...existingIds.filter((id) => !parsedIds.includes(id)),
  ];

  const links = reorderSupportLinks(fullOrder).map(serializeSupportLink);
  return res.json({ links });
});

app.post('/api/push-subscriptions', authenticate, (req: AuthedRequest, res: Response) => {
  const { token, announcementAlertsEnabled, eventAlertsEnabled } = req.body ?? {};
  if (typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({ error: 'token is required' });
  }
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const subscription = upsertPushSubscription(req.user.id, token.trim(), {
    announcementAlertsEnabled: typeof announcementAlertsEnabled === 'boolean' ? announcementAlertsEnabled : undefined,
    eventAlertsEnabled: typeof eventAlertsEnabled === 'boolean' ? eventAlertsEnabled : undefined,
  });
  return res.status(201).json({ subscription });
});

app.get('/api/push-subscriptions', authenticate, (req: AuthedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const existing = findPushSubscriptionByUserId(req.user.id);
  return res.json({ subscription: existing ? serializePushSubscription(existing) : null });
});

app.delete('/api/push-subscriptions', authenticate, (req: AuthedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  deletePushSubscription(req.user.id);
  return res.status(204).send();
});

app.post('/api/web-push-subscriptions', authenticate, (req: AuthedRequest, res: Response) => {
  const { endpoint, keys } = req.body ?? {};
  if (typeof endpoint !== 'string' || !endpoint.trim()) {
    return res.status(400).json({ error: 'endpoint is required' });
  }
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') {
    return res.status(400).json({ error: 'keys.p256dh and keys.auth are required' });
  }
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const subscription = upsertWebPushSubscription(req.user.id, endpoint.trim(), keys.p256dh, keys.auth);
  return res.status(201).json({ subscription });
});

app.get('/api/web-push-subscriptions', authenticate, (req: AuthedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { id: userId } = req.user;
  const subscriptions = listWebPushSubscriptions()
    .filter((row) => row.user_id === userId)
    .map(serializeWebPushSubscription);
  return res.json({ subscriptions });
});

app.get('/api/web-push/public-key', (_req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(404).json({ error: 'Web push not configured' });
  }
  return res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.delete('/api/web-push-subscriptions', authenticate, (req: AuthedRequest, res: Response) => {
  const { endpoint } = req.body ?? {};
  if (typeof endpoint !== 'string' || !endpoint.trim()) {
    return res.status(400).json({ error: 'endpoint is required' });
  }
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const existing = findWebPushSubscriptionByEndpoint(endpoint.trim());
  if (!existing || existing.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Subscription not found' });
  }
  deleteWebPushSubscription(endpoint.trim());
  return res.status(204).send();
});

function validateWorkingGroup(body: unknown) {
  const { name, description, members } = (body ?? {}) as Record<string, unknown>;
  if (typeof name !== 'string' || !name.trim()) {
    return 'name is required';
  }
  if (typeof description !== 'string' || !description.trim()) {
    return 'description is required';
  }
  if (typeof members !== 'string' || !members.trim()) {
    return 'members is required';
  }
  return null;
}

app.get('/api/working-groups', authenticate, (_req, res) => {
  const groups = listWorkingGroups().map(serializeWorkingGroup);
  res.json({ groups });
});

app.post('/api/working-groups', authenticate, requireAdmin, (req, res) => {
  const error = validateWorkingGroup(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const { name, description, members } = req.body as { name: string; description: string; members: string };
  const created = createWorkingGroup(name.trim(), description.trim(), members.trim());
  res.status(201).json({ group: serializeWorkingGroup(created) });
});

app.patch('/api/working-groups/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' });
  }
  const error = validateWorkingGroup(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const { name, description, members } = req.body as { name: string; description: string; members: string };
  const existing = findWorkingGroupById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Working group not found' });
  }
  const updated = updateWorkingGroup(id, name.trim(), description.trim(), members.trim());
  res.json({ group: serializeWorkingGroup(updated as WorkingGroupRow) });
});

function validateEvent(body: unknown) {
  const { name, description, workingGroupId, startAt, endAt, location, recurrence, seriesEndAt } = (body ?? {}) as Record<string, unknown>;
  if (typeof name !== 'string' || !name.trim()) {
    return 'name is required';
  }
  if (typeof description !== 'string' || !description.trim()) {
    return 'description is required';
  }
  const parsedWorkingGroupId = Number(workingGroupId);
  if (!Number.isFinite(parsedWorkingGroupId) || parsedWorkingGroupId <= 0) {
    return 'workingGroupId must be a positive number';
  }
  if (typeof startAt !== 'string' || !startAt.trim()) {
    return 'startAt is required';
  }
  if (Number.isNaN(new Date(startAt).getTime())) {
    return 'startAt must be a valid date string';
  }
  if (typeof endAt !== 'string' || !endAt.trim()) {
    return 'endAt is required';
  }
  const parsedEnd = new Date(endAt);
  if (Number.isNaN(parsedEnd.getTime())) {
    return 'endAt must be a valid date string';
  }
  if (parsedEnd.getTime() < new Date(startAt).getTime()) {
    return 'endAt must be after startAt';
  }
  if (typeof location !== 'string' || !location.trim()) {
    return 'location is required';
  }
  if (recurrence && recurrence !== 'none') {
    if (!seriesEndAt || typeof seriesEndAt !== 'string' || !seriesEndAt.trim()) {
      return 'seriesEndAt is required for recurring events';
    }
    const seriesEndDate = new Date(seriesEndAt);
    if (Number.isNaN(seriesEndDate.getTime())) {
      return 'seriesEndAt must be a valid date string';
    }
    if (seriesEndDate.getTime() < parsedEnd.getTime()) {
      return 'seriesEndAt must be after endAt';
    }
  }
  return null;
}

type RecurrenceRule = 'none' | 'daily' | 'weekly' | 'monthly';

function expandRecurringEvents(params: {
  baseEvent: {
    name: string;
    description: string;
    workingGroupId: number;
    startAt: Date;
    endAt: Date;
    location: string;
  };
  recurrence: RecurrenceRule;
  seriesEnd: Date | null;
  seriesUuid: string | null;
}): Array<{
  name: string;
  description: string;
  workingGroupId: number;
  startAt: string;
  endAt: string;
  location: string;
  seriesUuid: string | null;
  recurrence: RecurrenceRule;
  seriesEndAt: string | null;
}> {
  const { baseEvent, recurrence, seriesEnd, seriesUuid } = params;
  const events: Array<{
    name: string;
    description: string;
    workingGroupId: number;
    startAt: string;
    endAt: string;
    location: string;
    seriesUuid: string | null;
    recurrence: RecurrenceRule;
    seriesEndAt: string | null;
  }> = [];

  const addDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };
  const addWeeks = (date: Date, weeks: number) => addDays(date, weeks * 7);
  const addMonths = (date: Date, months: number) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  };

  const startIso = baseEvent.startAt.toISOString();
  const endIso = baseEvent.endAt.toISOString();
  events.push({
    name: baseEvent.name,
    description: baseEvent.description,
    workingGroupId: baseEvent.workingGroupId,
    startAt: startIso,
    endAt: endIso,
    location: baseEvent.location,
    seriesUuid,
    recurrence,
    seriesEndAt: seriesEnd ? seriesEnd.toISOString() : null,
  });

  if (recurrence === 'none' || !seriesEnd) {
    return events;
  }

  let cursorStart = new Date(baseEvent.startAt);
  let cursorEnd = new Date(baseEvent.endAt);
  while (true) {
    switch (recurrence) {
      case 'daily':
        cursorStart = addDays(cursorStart, 1);
        cursorEnd = addDays(cursorEnd, 1);
        break;
      case 'weekly':
        cursorStart = addWeeks(cursorStart, 1);
        cursorEnd = addWeeks(cursorEnd, 1);
        break;
      case 'monthly':
        cursorStart = addMonths(cursorStart, 1);
        cursorEnd = addMonths(cursorEnd, 1);
        break;
      default:
        return events;
    }
    if (cursorStart.getTime() > seriesEnd.getTime()) {
      break;
    }
    events.push({
      name: baseEvent.name,
      description: baseEvent.description,
      workingGroupId: baseEvent.workingGroupId,
      startAt: cursorStart.toISOString(),
      endAt: cursorEnd.toISOString(),
      location: baseEvent.location,
      seriesUuid,
      recurrence,
      seriesEndAt: seriesEnd ? seriesEnd.toISOString() : null,
    });
  }

  return events;
}

app.get('/api/events', authenticate, (_req, res) => {
  const userId = (res.req as AuthedRequest).user?.id ?? null;
  const userEventIds = userId ? new Set(listUserEventIds(userId)) : new Set<number>();

  const nowIso = new Date().toISOString();
  const eventsRaw = listUpcomingEvents(nowIso);
  const attendeeCounts = countAttendeesByEventIds(eventsRaw.map((e) => e.id));
  const events = eventsRaw.map((evt) => {
    const serialized = serializeEvent(evt);
    const attending = userEventIds.has(evt.id);
    return {
      ...serialized,
      attending,
      attendeeCount: attendeeCounts[evt.id] ?? 0,
    };
  });

  const grouped = events.reduce<Record<string, { upcoming: typeof events; next: typeof events[number] }>>((acc, evt) => {
    const key = evt.seriesUuid ?? `single-${evt.id}`;
    if (!acc[key]) {
      acc[key] = { upcoming: [], next: evt };
    }
    acc[key].upcoming.push(evt);
    if (new Date(evt.startAt).getTime() < new Date(acc[key].next.startAt).getTime()) {
      acc[key].next = evt;
    }
    return acc;
  }, {});

  const response = Object.values(grouped).map(({ next, upcoming }) => ({
    ...next,
    attending:
      next.attending || (next.seriesUuid ? upcoming.some((e) => e.attending) : false),
    upcomingOccurrences: upcoming
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, 5)
      .map((e) => ({
        eventId: e.id,
        startAt: e.startAt,
        attendeeCount: e.attendeeCount ?? 0,
        attending: Boolean(e.attending),
      })),
  }));

  res.json({ events: response });
});

app.post('/api/events', authenticate, requireAdmin, (req, res) => {
  const error = validateEvent(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const { name, description, workingGroupId, startAt, endAt, location, recurrence, seriesEndAt } = req.body as {
    name: string;
    description: string;
    workingGroupId: number;
    startAt: string;
    endAt: string;
    location: string;
    recurrence?: RecurrenceRule;
    seriesEndAt?: string | null;
  };

  const numericWorkingGroupId = Number(workingGroupId);
  const workingGroup = findWorkingGroupById(numericWorkingGroupId);
  if (!workingGroup) {
    return res.status(400).json({ error: 'workingGroupId must reference an existing working group' });
  }

  const baseStart = new Date(startAt);
  const baseEnd = new Date(endAt);
  const rule: RecurrenceRule = recurrence ?? 'none';
  const seriesUuid = rule === 'none' ? null : crypto.randomUUID();
  const seriesEndDate = seriesEndAt ? new Date(seriesEndAt) : null;

  const expanded = expandRecurringEvents({
    baseEvent: {
      name: name.trim(),
      description: description.trim(),
      workingGroupId: numericWorkingGroupId,
      startAt: baseStart,
      endAt: baseEnd,
      location: location.trim(),
    },
    recurrence: rule,
    seriesEnd: seriesEndDate,
    seriesUuid,
  });

  const createdEvents = expanded.map((payload) =>
    createEvent(
      payload.name,
      payload.description,
      payload.workingGroupId,
      payload.startAt,
      payload.endAt,
      payload.location,
      payload.seriesUuid,
      payload.recurrence === 'none' ? null : payload.recurrence,
      payload.seriesEndAt
    )
  );

  const first = createdEvents[0];
  res.status(201).json({ event: serializeEvent({ ...first, working_group_name: workingGroup.name }) });
});

app.patch('/api/events/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' });
  }

  const error = validateEvent(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const { name, description, workingGroupId, startAt, endAt, location, recurrence, seriesEndAt } = req.body as {
    name: string;
    description: string;
    workingGroupId: number;
    startAt: string;
    endAt: string;
    location: string;
    recurrence?: RecurrenceRule;
    seriesEndAt?: string | null;
  };

  const numericWorkingGroupId = Number(workingGroupId);
  const workingGroup = findWorkingGroupById(numericWorkingGroupId);
  if (!workingGroup) {
    return res.status(400).json({ error: 'workingGroupId must reference an existing working group' });
  }

  const existing = findEventById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const recurrenceRule: RecurrenceRule = recurrence ?? 'none';
  const seriesEndDate = seriesEndAt ? new Date(seriesEndAt) : null;

  if (recurrenceRule !== 'none') {
    const seriesUuid = existing.series_uuid ?? crypto.randomUUID();
    if (existing.series_uuid) {
      deleteEventsBySeries(existing.series_uuid);
    } else {
      deleteEventById(id);
    }

    const baseStart = new Date(startAt);
    const baseEnd = new Date(endAt);
    const expanded = expandRecurringEvents({
      baseEvent: {
        name: name.trim(),
        description: description.trim(),
        workingGroupId: numericWorkingGroupId,
        startAt: baseStart,
        endAt: baseEnd,
        location: location.trim(),
      },
      recurrence: recurrenceRule,
      seriesEnd: seriesEndDate,
      seriesUuid,
    });

    const createdEvents = expanded.map((payload) =>
      createEvent(
        payload.name,
        payload.description,
        payload.workingGroupId,
        payload.startAt,
        payload.endAt,
        payload.location,
        payload.seriesUuid,
        payload.recurrence === 'none' ? null : payload.recurrence,
        payload.seriesEndAt
      )
    );
    const first = createdEvents[0];
    return res.json({ event: serializeEvent({ ...first, working_group_name: workingGroup.name }) });
  }

  if (existing.series_uuid) {
    deleteEventsBySeries(existing.series_uuid);
  }
  const single = createEvent(
    name.trim(),
    description.trim(),
    numericWorkingGroupId,
    new Date(startAt).toISOString(),
    new Date(endAt).toISOString(),
    location.trim(),
    null,
    null,
    null
  );
  res.json({ event: serializeEvent({ ...single, working_group_name: workingGroup.name }) });
});

type ExpoPushMessage = { to: string; title: string; body: string };

async function dispatchExpoPushMessages(messages: ExpoPushMessage[]) {
  if (!EXPO_PUSH_TOKEN || !messages.length) {
    return;
  }
  const chunkSize = 50;
  for (let i = 0; i < messages.length; i += chunkSize) {
    const batch = messages.slice(i, i + chunkSize);
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${EXPO_PUSH_TOKEN}`,
        },
        body: JSON.stringify(batch),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to send push notifications', err);
    }
  }
}

async function sendAnnouncementPush(body: string) {
  const subscribers = listPushSubscriptions().filter((row) => row.announcement_alerts_enabled);
  const messages = subscribers.map((row) => ({
    to: row.token,
    title: 'New announcement',
    body,
  }));
  await dispatchExpoPushMessages(messages);

  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    const webSubs = listWebPushSubscriptions();
    const payload = JSON.stringify({ title: 'New announcement', body });
    for (const sub of webSubs) {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to send web push', err);
      }
    }
  }
}

function isSameUtcDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

async function processEventAlertNotifications() {
  if (!EXPO_PUSH_TOKEN) {
    return;
  }
  const now = new Date();
  const candidates = listEventAlertCandidates(EVENT_ALERT_LOOKAHEAD_HOURS);
  const messages: ExpoPushMessage[] = [];
  for (const candidate of candidates) {
    const startAt = new Date(candidate.start_at);
    if (Number.isNaN(startAt.getTime())) {
      continue;
    }
    const diffMs = startAt.getTime() - now.getTime();
    if (diffMs <= 0) {
      continue;
    }

    if (isSameUtcDay(startAt, now) && !hasEventNotificationLog(candidate.event_id, candidate.user_id, 'day-of')) {
      recordEventNotificationLog(candidate.event_id, candidate.user_id, 'day-of');
      messages.push({
        to: candidate.token,
        title: 'Event reminder',
        body: `Reminder: ${candidate.event_name} is happening today.`,
      });
    }

    if (diffMs <= EVENT_ALERT_HOUR_MS && !hasEventNotificationLog(candidate.event_id, candidate.user_id, 'hour-before')) {
      recordEventNotificationLog(candidate.event_id, candidate.user_id, 'hour-before');
      messages.push({
        to: candidate.token,
        title: 'Event reminder',
        body: 'You have an event happening today!',
      });
    }
  }

  if (messages.length) {
    await dispatchExpoPushMessages(messages);
  }
}

function startEventAlertScheduler() {
  if (eventAlertTimer) {
    return;
  }
  const runner = () => {
    void processEventAlertNotifications().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to process event alerts', err);
    });
  };
  runner();
  eventAlertTimer = setInterval(runner, EVENT_ALERT_INTERVAL_MS);
}

app.patch('/api/support-links/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' });
  }

  const error = validateSupportLinkBody(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const { title, description, link } = req.body as {
    title: string;
    description: string;
    link: string;
  };

  const updated = updateSupportLink(id, title.trim(), description.trim(), link.trim());
  if (!updated) {
    return res.status(404).json({ error: 'Support link not found' });
  }
  return res.json({ link: serializeSupportLink(updated) });
});

app.delete('/api/support-links/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' });
  }
  deleteSupportLink(id);
  return res.status(204).send();
});

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
  startEventAlertScheduler();
});
app.post('/api/events/:id/attendees', authenticate, (req: AuthedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' });
  }
  const applySeries = Boolean(req.body?.series);
  const existing = findEventById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const targetEvents =
    applySeries && existing.series_uuid ? listEventsBySeries(existing.series_uuid) : [existing];

  targetEvents.forEach((evt) => {
    addEventAttendee(req.user!.id, evt.id);
  });

  return res.status(201).json({ attending: true });
});

app.delete('/api/events/:id/attendees', authenticate, (req: AuthedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' });
  }
  const applySeries = Boolean(req.body?.series);
  const existing = findEventById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const targetEvents =
    applySeries && existing.series_uuid ? listEventsBySeries(existing.series_uuid) : [existing];

  targetEvents.forEach((evt) => {
    deleteEventAttendee(req.user!.id, evt.id);
  });

  return res.status(204).send();
});
