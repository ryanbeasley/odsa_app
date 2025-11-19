"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const google_auth_library_1 = require("google-auth-library");
const web_push_1 = __importDefault(require("web-push"));
const db_1 = require("./db");
dotenv_1.default.config();
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';
const TOKEN_EXPIRY = process.env.JWT_EXPIRY ?? '7d';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new google_auth_library_1.OAuth2Client(GOOGLE_CLIENT_ID) : null;
const EXPO_PUSH_TOKEN = process.env.EXPO_PUSH_ACCESS_TOKEN;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    web_push_1.default.setVapidDetails('mailto:push@odsa.local', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}
const app = (0, express_1.default)();
app.use(express_1.default.json());
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
function toPublicUser(user) {
    return { id: user.id, email: user.email, role: user.role };
}
function signToken(user) {
    return jsonwebtoken_1.default.sign({
        sub: String(user.id),
        email: user.email,
        role: user.role,
    }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization token required' });
    }
    const token = authHeader.slice('Bearer '.length);
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = (0, db_1.findUserById)(Number(payload.sub));
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        req.user = { id: user.id, email: user.email, role: user.role };
        next();
    }
    catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}
function requireAdmin(req, res, next) {
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
    if ((0, db_1.findUserByEmail)(normalizedEmail)) {
        return res.status(409).json({ error: 'email already registered' });
    }
    const passwordHash = bcryptjs_1.default.hashSync(password, 10);
    const user = (0, db_1.createUser)(normalizedEmail, passwordHash, 'user');
    const token = signToken(user);
    res.status(201).json({ token, user: toPublicUser(user) });
});
app.post('/api/login', (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'email and password are required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = (0, db_1.findUserByEmail)(normalizedEmail);
    if (!user) {
        return res.status(401).json({ error: 'invalid credentials' });
    }
    if (!bcryptjs_1.default.compareSync(password, user.password_hash)) {
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
        let user = (0, db_1.findUserByEmail)(normalizedEmail);
        if (!user) {
            const randomSecret = crypto_1.default.randomBytes(32).toString('hex');
            const passwordHash = bcryptjs_1.default.hashSync(randomSecret, 10);
            user = (0, db_1.createUser)(normalizedEmail, passwordHash, 'user');
        }
        const token = signToken(user);
        res.json({ token, user: toPublicUser(user) });
    }
    catch (err) {
        return res.status(401).json({ error: 'Invalid Google token' });
    }
});
function serializeAnnouncement(row) {
    return {
        id: row.id,
        body: row.body,
        createdAt: new Date(row.created_at).toISOString(),
    };
}
function serializePushSubscription(row) {
    return {
        token: row.token,
        createdAt: new Date(row.created_at).toISOString(),
    };
}
function serializeWebPushSubscription(row) {
    return {
        endpoint: row.endpoint,
        createdAt: new Date(row.created_at).toISOString(),
    };
}
function serializeWorkingGroup(row) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        members: row.members,
        createdAt: new Date(row.created_at).toISOString(),
    };
}
function serializeEvent(row) {
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
function parseLimit(value, fallback = 5) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return Math.min(20, Math.max(1, Math.floor(parsed)));
}
function handleGetAnnouncements(req, res) {
    const limit = parseLimit(req.query.limit);
    const cursorParam = Array.isArray(req.query.cursor) ? req.query.cursor[0] : req.query.cursor;
    const cursor = cursorParam ? Number(cursorParam) : undefined;
    if (cursorParam && (!cursor || cursor <= 0)) {
        return res.status(400).json({ error: 'cursor must be a positive number' });
    }
    const rows = (0, db_1.listAnnouncements)(limit, cursor);
    const announcements = rows.map(serializeAnnouncement);
    const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;
    res.json({ announcements, nextCursor });
}
async function handleCreateAnnouncement(req, res) {
    const { message } = req.body ?? {};
    if (typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'message must be a non-empty string' });
    }
    const announcement = (0, db_1.createAnnouncement)(message.trim());
    void sendAnnouncementPush(announcement.body);
    res.status(201).json({ announcement: serializeAnnouncement(announcement) });
}
app.get('/api/announcements', authenticate, handleGetAnnouncements);
app.get('/api/hello', authenticate, handleGetAnnouncements);
app.post('/api/announcements', authenticate, requireAdmin, handleCreateAnnouncement);
app.post('/api/hello', authenticate, requireAdmin, handleCreateAnnouncement);
function serializeSupportLink(row) {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        link: row.link,
        createdAt: new Date(row.created_at).toISOString(),
    };
}
app.get('/api/support-links', authenticate, (_req, res) => {
    const links = (0, db_1.listSupportLinks)().map(serializeSupportLink);
    res.json({ links });
});
function validateSupportLinkBody(body) {
    const { title, description, link } = (body ?? {});
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
    const { title, description, link } = req.body;
    const created = (0, db_1.createSupportLink)(title.trim(), description.trim(), link.trim());
    return res.status(201).json({ link: serializeSupportLink(created) });
});
app.patch('/api/support-links/reorder', authenticate, requireAdmin, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
    if (!ids?.length || !ids.every((value) => Number.isFinite(Number(value)))) {
        return res.status(400).json({ error: 'ids must be an array of numbers' });
    }
    const parsedIds = ids.map((value) => Number(value));
    const uniqueIds = new Set(parsedIds);
    if (uniqueIds.size !== parsedIds.length) {
        return res.status(400).json({ error: 'ids must be unique' });
    }
    const existingIds = (0, db_1.listSupportLinks)().map((link) => link.id);
    const missingIds = parsedIds.filter((id) => !existingIds.includes(id));
    if (missingIds.length) {
        return res.status(400).json({ error: 'ids must match existing support links' });
    }
    const fullOrder = [
        ...parsedIds,
        ...existingIds.filter((id) => !parsedIds.includes(id)),
    ];
    const links = (0, db_1.reorderSupportLinks)(fullOrder).map(serializeSupportLink);
    return res.json({ links });
});
app.post('/api/push-subscriptions', authenticate, (req, res) => {
    const { token } = req.body ?? {};
    if (typeof token !== 'string' || !token.trim()) {
        return res.status(400).json({ error: 'token is required' });
    }
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const subscription = (0, db_1.upsertPushSubscription)(req.user.id, token.trim());
    return res.status(201).json({ subscription });
});
app.get('/api/push-subscriptions', authenticate, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const existing = (0, db_1.findPushSubscriptionByUserId)(req.user.id);
    return res.json({ subscription: existing ? serializePushSubscription(existing) : null });
});
app.delete('/api/push-subscriptions', authenticate, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    (0, db_1.deletePushSubscription)(req.user.id);
    return res.status(204).send();
});
app.post('/api/web-push-subscriptions', authenticate, (req, res) => {
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
    const subscription = (0, db_1.upsertWebPushSubscription)(req.user.id, endpoint.trim(), keys.p256dh, keys.auth);
    return res.status(201).json({ subscription });
});
app.get('/api/web-push-subscriptions', authenticate, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id: userId } = req.user;
    const subscriptions = (0, db_1.listWebPushSubscriptions)()
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
app.delete('/api/web-push-subscriptions', authenticate, (req, res) => {
    const { endpoint } = req.body ?? {};
    if (typeof endpoint !== 'string' || !endpoint.trim()) {
        return res.status(400).json({ error: 'endpoint is required' });
    }
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const existing = (0, db_1.findWebPushSubscriptionByEndpoint)(endpoint.trim());
    if (!existing || existing.user_id !== req.user.id) {
        return res.status(404).json({ error: 'Subscription not found' });
    }
    (0, db_1.deleteWebPushSubscription)(endpoint.trim());
    return res.status(204).send();
});
function validateWorkingGroup(body) {
    const { name, description, members } = (body ?? {});
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
    const groups = (0, db_1.listWorkingGroups)().map(serializeWorkingGroup);
    res.json({ groups });
});
app.post('/api/working-groups', authenticate, requireAdmin, (req, res) => {
    const error = validateWorkingGroup(req.body);
    if (error) {
        return res.status(400).json({ error });
    }
    const { name, description, members } = req.body;
    const created = (0, db_1.createWorkingGroup)(name.trim(), description.trim(), members.trim());
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
    const { name, description, members } = req.body;
    const existing = (0, db_1.findWorkingGroupById)(id);
    if (!existing) {
        return res.status(404).json({ error: 'Working group not found' });
    }
    const updated = (0, db_1.updateWorkingGroup)(id, name.trim(), description.trim(), members.trim());
    res.json({ group: serializeWorkingGroup(updated) });
});
function validateEvent(body) {
    const { name, description, workingGroupId, startAt, endAt, location, recurrence, seriesEndAt } = (body ?? {});
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
function expandRecurringEvents(params) {
    const { baseEvent, recurrence, seriesEnd, seriesUuid } = params;
    const events = [];
    const addDays = (date, days) => {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    };
    const addWeeks = (date, weeks) => addDays(date, weeks * 7);
    const addMonths = (date, months) => {
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
    const userId = res.req.user?.id ?? null;
    const userEventIds = userId ? new Set((0, db_1.listUserEventIds)(userId)) : new Set();
    const nowIso = new Date().toISOString();
    const eventsRaw = (0, db_1.listUpcomingEvents)(nowIso);
    const attendeeCounts = (0, db_1.countAttendeesByEventIds)(eventsRaw.map((e) => e.id));
    const events = eventsRaw.map((evt) => {
        const serialized = serializeEvent(evt);
        const attending = userEventIds.has(evt.id);
        return {
            ...serialized,
            attending,
            attendeeCount: attendeeCounts[evt.id] ?? 0,
        };
    });
    const grouped = events.reduce((acc, evt) => {
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
        attending: next.attending || (next.seriesUuid ? upcoming.some((e) => e.attending) : false),
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
    const { name, description, workingGroupId, startAt, endAt, location, recurrence, seriesEndAt } = req.body;
    const numericWorkingGroupId = Number(workingGroupId);
    const workingGroup = (0, db_1.findWorkingGroupById)(numericWorkingGroupId);
    if (!workingGroup) {
        return res.status(400).json({ error: 'workingGroupId must reference an existing working group' });
    }
    const baseStart = new Date(startAt);
    const baseEnd = new Date(endAt);
    const rule = recurrence ?? 'none';
    const seriesUuid = rule === 'none' ? null : crypto_1.default.randomUUID();
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
    const createdEvents = expanded.map((payload) => (0, db_1.createEvent)(payload.name, payload.description, payload.workingGroupId, payload.startAt, payload.endAt, payload.location, payload.seriesUuid, payload.recurrence === 'none' ? null : payload.recurrence, payload.seriesEndAt));
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
    const { name, description, workingGroupId, startAt, endAt, location, recurrence, seriesEndAt } = req.body;
    const numericWorkingGroupId = Number(workingGroupId);
    const workingGroup = (0, db_1.findWorkingGroupById)(numericWorkingGroupId);
    if (!workingGroup) {
        return res.status(400).json({ error: 'workingGroupId must reference an existing working group' });
    }
    const existing = (0, db_1.findEventById)(id);
    if (!existing) {
        return res.status(404).json({ error: 'Event not found' });
    }
    const recurrenceRule = recurrence ?? 'none';
    const seriesEndDate = seriesEndAt ? new Date(seriesEndAt) : null;
    if (recurrenceRule !== 'none') {
        const seriesUuid = existing.series_uuid ?? crypto_1.default.randomUUID();
        if (existing.series_uuid) {
            (0, db_1.deleteEventsBySeries)(existing.series_uuid);
        }
        else {
            (0, db_1.deleteEventById)(id);
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
        const createdEvents = expanded.map((payload) => (0, db_1.createEvent)(payload.name, payload.description, payload.workingGroupId, payload.startAt, payload.endAt, payload.location, payload.seriesUuid, payload.recurrence === 'none' ? null : payload.recurrence, payload.seriesEndAt));
        const first = createdEvents[0];
        return res.json({ event: serializeEvent({ ...first, working_group_name: workingGroup.name }) });
    }
    if (existing.series_uuid) {
        (0, db_1.deleteEventsBySeries)(existing.series_uuid);
    }
    const single = (0, db_1.createEvent)(name.trim(), description.trim(), numericWorkingGroupId, new Date(startAt).toISOString(), new Date(endAt).toISOString(), location.trim(), null, null, null);
    res.json({ event: serializeEvent({ ...single, working_group_name: workingGroup.name }) });
});
async function sendAnnouncementPush(body) {
    if (!EXPO_PUSH_TOKEN) {
        return;
    }
    const tokens = (0, db_1.listPushSubscriptions)().map((row) => row.token);
    if (tokens.length) {
        const messages = tokens.map((token) => ({
            to: token,
            title: 'New announcement',
            body,
        }));
        try {
            await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${EXPO_PUSH_TOKEN}`,
                },
                body: JSON.stringify(messages),
            });
        }
        catch (err) {
            // eslint-disable-next-line no-console
            console.error('Failed to send push notifications', err);
        }
    }
    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        const webSubs = (0, db_1.listWebPushSubscriptions)();
        const payload = JSON.stringify({ title: 'New announcement', body });
        for (const sub of webSubs) {
            try {
                await web_push_1.default.sendNotification({
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth },
                }, payload);
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.error('Failed to send web push', err);
            }
        }
    }
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
    const { title, description, link } = req.body;
    const updated = (0, db_1.updateSupportLink)(id, title.trim(), description.trim(), link.trim());
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
    (0, db_1.deleteSupportLink)(id);
    return res.status(204).send();
});
const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${port}`);
});
app.post('/api/events/:id/attendees', authenticate, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'id must be a positive number' });
    }
    const applySeries = Boolean(req.body?.series);
    const existing = (0, db_1.findEventById)(id);
    if (!existing) {
        return res.status(404).json({ error: 'Event not found' });
    }
    const targetEvents = applySeries && existing.series_uuid ? (0, db_1.listEventsBySeries)(existing.series_uuid) : [existing];
    targetEvents.forEach((evt) => {
        (0, db_1.addEventAttendee)(req.user.id, evt.id);
    });
    return res.status(201).json({ attending: true });
});
app.delete('/api/events/:id/attendees', authenticate, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'id must be a positive number' });
    }
    const applySeries = Boolean(req.body?.series);
    const existing = (0, db_1.findEventById)(id);
    if (!existing) {
        return res.status(404).json({ error: 'Event not found' });
    }
    const targetEvents = applySeries && existing.series_uuid ? (0, db_1.listEventsBySeries)(existing.series_uuid) : [existing];
    targetEvents.forEach((evt) => {
        (0, db_1.deleteEventAttendee)(req.user.id, evt.id);
    });
    return res.status(204).send();
});
