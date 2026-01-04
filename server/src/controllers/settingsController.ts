import { Response, Router } from 'express';
import { authenticate, AuthedRequest, requireAdmin } from '../middleware/authenticate';
import {
  deletePushSubscription,
  findPushSubscriptionByUserId,
  upsertPushSubscription,
} from '../repositories/pushSubscriptionRepository';
import { listUsers, updateUserProfile, updateUserRole, findUserByEmail } from '../repositories/userRepository';
import { serializePushSubscription, toPublicUser } from '../utils/serializer';
import { signToken } from '../utils/jwt';
import { syncDiscordEvents } from '../services/discordService';

const router = Router();

/**
 * Updates the authenticated user's profile details.
 */
router.patch('/profile', authenticate, (req: AuthedRequest, res) => {
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  const result = buildProfileUpdates(req.body, user.email);
  if ('error' in result) {
    return res.status(result.status).json({ error: result.error });
  }

  const updated = updateUserProfile(user.id, result.updates);
  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }
  const token = signToken(updated);
  return res.json({ token, user: toPublicUser(updated) });
});

/**
 * Registers or updates the Expo push subscription for the current user.
 */
router.post('/push-subscriptions', authenticate, (req: AuthedRequest, res) => {
  const { token, announcementAlertsEnabled, eventAlertsEnabled } = req.body ?? {};
  if (typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({ error: 'token is required' });
  }
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  const subscription = upsertPushSubscription(user.id, token.trim(), {
    announcementAlertsEnabled: typeof announcementAlertsEnabled === 'boolean' ? announcementAlertsEnabled : undefined,
    eventAlertsEnabled: typeof eventAlertsEnabled === 'boolean' ? eventAlertsEnabled : undefined,
  });
  return res.status(201).json({ subscription: serializePushSubscription(subscription) });
});

/**
 * Returns the current push subscription for the authenticated user.
 */
router.get('/push-subscriptions', authenticate, (req: AuthedRequest, res) => {
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  const existing = findPushSubscriptionByUserId(user.id);
  return res.json({ subscription: existing ? serializePushSubscription(existing) : null });
});

/**
 * Deletes the current user's push subscription.
 */
router.delete('/push-subscriptions', authenticate, (req: AuthedRequest, res) => {
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  deletePushSubscription(user.id);
  return res.status(204).send();
});

/**
 * Lists users (admin only) with optional search query.
 */
router.get('/users', authenticate, requireAdmin, (req: AuthedRequest, res) => {
  const queryParam = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
  const users = listUsers(typeof queryParam === 'string' ? queryParam : undefined).map(toPublicUser);
  return res.json({ users });
});

/**
 * Updates a user's role (admin only) while preventing self-demotion.
 */
router.patch('/users/:id/role', authenticate, requireAdmin, (req: AuthedRequest, res) => {
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

/**
 * Syncs scheduled events from Discord into the local database (admin only).
 */
router.post('/discord-sync', authenticate, requireAdmin, async (_req: AuthedRequest, res) => {
  try {
    const result = await syncDiscordEvents();
    return res.json({ synced: result.count, skipped: result.skipped });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync Discord events';
    return res.status(500).json({ error: message });
  }
});

export default router;

type ProfileUpdates = {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string;
  event_alerts_sms_enabled?: number;
};

function requireUser(req: AuthedRequest, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return req.user;
}

function readOptionalString(value: unknown) {
  if (value === undefined) {
    return { value: undefined };
  }
  if (value !== null && typeof value !== 'string') {
    return null;
  }
  const trimmed = typeof value === 'string' ? value.trim() : null;
  return { value: trimmed };
}

function normalizePhoneToE164(value: string | null) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^\+\d{8,15}$/.test(trimmed)) {
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return null;
}

type ProfileUpdateResult = { updates: ProfileUpdates } | { error: string; status: number };

function buildProfileUpdates(body: unknown, currentEmail: string): ProfileUpdateResult {
  const { firstName, lastName, phone, email, eventAlertsSmsEnabled } = (body ?? {}) as Record<string, unknown>;
  const updates: ProfileUpdates = {};

  const assignOptionalField = (
    label: string,
    input: unknown,
    apply: (value: string | null) => void
  ): ProfileUpdateResult | null => {
    const parsed = readOptionalString(input);
    if (parsed === null) {
      return { error: `${label} must be a string`, status: 400 };
    }
    if (parsed.value !== undefined) {
      apply(parsed.value);
    }
    return null;
  };

  const firstError = assignOptionalField('First name', firstName, (value) => {
    updates.first_name = value;
  });
  if (firstError) {
    return firstError;
  }

  const lastError = assignOptionalField('Last name', lastName, (value) => {
    updates.last_name = value;
  });
  if (lastError) {
    return lastError;
  }

  const parsedPhone = readOptionalString(phone);
  if (parsedPhone === null) {
    return { error: 'Phone must be a string', status: 400 };
  }
  if (parsedPhone.value !== undefined) {
    const normalized = normalizePhoneToE164(parsedPhone.value);
    if (parsedPhone.value && !normalized) {
      return { error: 'Phone must be a valid E.164 number (e.g. +14075551234)', status: 400 };
    }
    updates.phone = normalized;
  }

  if (email === undefined) {
    if (eventAlertsSmsEnabled === undefined) {
      return { updates };
    }
  }

  if (eventAlertsSmsEnabled !== undefined) {
    if (typeof eventAlertsSmsEnabled !== 'boolean') {
      return { error: 'SMS event alerts must be true or false', status: 400 };
    }
    updates.event_alerts_sms_enabled = eventAlertsSmsEnabled ? 1 : 0;
  }

  if (email === undefined) {
    return { updates };
  }

  if (email !== null && typeof email !== 'string') {
    return { error: 'Email must be a string', status: 400 };
  }
  const normalizedEmail = email?.trim().toLowerCase() ?? null;
  if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { error: 'Email is invalid', status: 400 };
  }
  if (normalizedEmail && normalizedEmail !== currentEmail && findUserByEmail(normalizedEmail)) {
    return { error: 'Email already registered', status: 409 };
  }
  if (normalizedEmail) {
    updates.email = normalizedEmail;
  }

  return { updates };
}
