import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { GOOGLE_CLIENT_ID } from '../config/env';
import { createUser, findUserByEmail } from '../repositories/userRepository';
import { signToken } from '../utils/jwt';
import { toPublicUser } from '../utils/serializer';

const router = Router();
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

/**
 * Registers a new user via email + password.
 */
router.post('/signup', (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || !email.trim()) {
    console.log('Attempt to register with invalid email:', email);
    return res.status(400).json({ error: 'email is required' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    console.log('Attempt to register with short password:', password);
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (findUserByEmail(normalizedEmail)) {
    console.log('Attempt to register with existing email:', normalizedEmail);
    return res.status(409).json({ error: 'email already registered' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const user = createUser(normalizedEmail, passwordHash, 'user');
  const token = signToken(user);
  console.log('Registered new user:', normalizedEmail);
  res.status(201).json({ token, user: toPublicUser(user) });
});

/**
 * Authenticates an existing user via email + password.
 */
router.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    console.log('Attempt to log in with missing credentials:', req.body);
    return res.status(400).json({ error: 'email and password are required' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const user = findUserByEmail(normalizedEmail);
  if (!user) {
    console.log('Failed login attempt for non-existent email:', normalizedEmail);
    return res.status(401).json({ error: 'invalid credentials' });
  }
  if (!bcrypt.compareSync(password, user.password_hash)) {
    console.log('Failed login attempt for email with incorrect password:', normalizedEmail);
    return res.status(401).json({ error: 'invalid credentials' });
  }
  console.log('User logged in:', normalizedEmail);
  const token = signToken(user);
  res.json({ token, user: toPublicUser(user) });
});

/* v8 ignore start */
router.post('/oauth/google', async (req, res) => {
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
    console.error(err);
    return res.status(401).json({ error: 'Invalid Google token' });
  }
});
/* v8 ignore stop */

export default router;
