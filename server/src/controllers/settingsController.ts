import { Router } from 'express';
import { EXPO_PUSH_TOKEN, VAPID_PUBLIC_KEY } from '../config/env';
import { authenticate, AuthedRequest, requireAdmin } from '../middleware/authenticate';
import {
  deletePushSubscription,
  findPushSubscriptionByUserId,
  upsertPushSubscription,
} from '../repositories/pushSubscriptionRepository';
import {
  deleteWebPushSubscription,
  findWebPushSubscriptionByEndpoint,
  listWebPushSubscriptions,
  upsertWebPushSubscription,
} from '../repositories/webPushRepository';
import { listUsers, updateUserProfile, updateUserRole, findUserByEmail } from '../repositories/userRepository';
import { serializePushSubscription, serializeWebPushSubscription, toPublicUser } from '../utils/serializer';
import { signToken } from '../utils/jwt';

const router = Router();

/**
 * Updates the authenticated user's profile details.
 */
router.patch('/profile', authenticate, (req: AuthedRequest, res) => {
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

/**
 * Registers or updates the Expo push subscription for the current user.
 */
router.post('/push-subscriptions', authenticate, (req: AuthedRequest, res) => {
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
  return res.status(201).json({ subscription: serializePushSubscription(subscription) });
});

/**
 * Returns the current push subscription for the authenticated user.
 */
router.get('/push-subscriptions', authenticate, (req: AuthedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const existing = findPushSubscriptionByUserId(req.user.id);
  return res.json({ subscription: existing ? serializePushSubscription(existing) : null });
});

/**
 * Deletes the current user's push subscription.
 */
router.delete('/push-subscriptions', authenticate, (req: AuthedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  deletePushSubscription(req.user.id);
  return res.status(204).send();
});

/**
 * Registers or updates a web push subscription (VAPID) for the user.
 */
router.post('/web-push-subscriptions', authenticate, (req: AuthedRequest, res) => {
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
  return res.status(201).json({ subscription: serializeWebPushSubscription(subscription) });
});

/**
 * Lists the user's web push subscriptions.
 */
router.get('/web-push-subscriptions', authenticate, (req: AuthedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { id: userId } = req.user;
  const subscriptions = listWebPushSubscriptions()
    .filter((row) => row.user_id === userId)
    .map(serializeWebPushSubscription);
  return res.json({ subscriptions });
});

/**
 * Deletes the user's web push subscription by endpoint.
 */
router.delete('/web-push-subscriptions', authenticate, (req: AuthedRequest, res) => {
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

/**
 * Returns the VAPID public key used for web push subscriptions.
 */
router.get('/web-push/public-key', (_req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(404).json({ error: 'Web push not configured' });
  }
  return res.json({ publicKey: VAPID_PUBLIC_KEY });
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

export default router;
