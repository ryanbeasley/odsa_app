import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import {
  createAnnouncement,
  createUser,
  findUserByEmail,
  findUserById,
  listAnnouncements,
  Role,
  AnnouncementRow,
} from './db';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';
const TOKEN_EXPIRY = process.env.JWT_EXPIRY ?? '7d';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

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
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

function toPublicUser(user: { id: number; email: string; role: Role }) {
  return { id: user.id, email: user.email, role: user.role };
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

function serializeAnnouncement(row: AnnouncementRow) {
  return {
    id: row.id,
    body: row.body,
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
  res.status(201).json({ announcement: serializeAnnouncement(announcement) });
}

app.get('/api/announcements', authenticate, handleGetAnnouncements);
app.get('/api/hello', authenticate, handleGetAnnouncements);

app.post('/api/announcements', authenticate, requireAdmin, handleCreateAnnouncement);
app.post('/api/hello', authenticate, requireAdmin, handleCreateAnnouncement);

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
});
