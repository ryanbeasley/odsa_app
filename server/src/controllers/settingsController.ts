import { RequestHandler } from 'express';
import { AuthedRequest } from '../middleware/authenticate';
import {
  deletePushSubscription,
  findPushSubscriptionByUserId,
  upsertPushSubscription,
} from '../repositories/pushSubscriptionRepository';
import { listUsers, updateUserProfile, updateUserRole, findUserByUsername, findUserByEmail } from '../repositories/userRepository';
import { serializePushSubscription, toPublicUser } from '../utils/serializer';
import { signToken } from '../utils/jwt';
import { syncDiscordEvents } from '../services/discordService';
import { ProfileUpdates } from '../validation/userSchemas';
import { PushSubscriptionPayload, SmsPushSubscriptionPayload, UserRolePayload } from '../validation/settingsSchemas';
import { UserIdParamPayload, UserListQueryPayload } from '../validation/settingsParamsSchemas';
import { RequestUser } from '../middleware/authenticate';
import { UserRow } from '../types';

/**
 * Updates the authenticated user's profile details.
 */
export const updateProfileHandler: RequestHandler = (req: AuthedRequest, res) => {
  const user = req.user as RequestUser;
  const updates = req.validated as ProfileUpdates;
  if (updates.username) {
    const usernameUserId = findUserByUsername(updates.username)?.id;
    if (updates.username && user.id !== usernameUserId) {
      console.log('Username already taken:', updates.username);
      return res.status(400).json({ error: 'Username already taken' });
    }
  }
  if (updates.email) {
    const emailUserId = findUserByEmail(updates.email)?.id;
    if (emailUserId && user.id !== emailUserId) {
      console.log('Email already in use:', updates.email);
      return res.status(400).json({ error: 'Email already in use' });
    }
  }
  const updated = updateUserProfile(user.id, updates) as UserRow;
  
  const token = signToken(updated);
  return res.json({ token, user: toPublicUser(updated) });
};

/**
 * Registers or updates the SMS subscription for the current user.
 */
export const upsertSmsSubscriptionHandler: RequestHandler = (req: AuthedRequest, res) => {
  const user = req.user as RequestUser;
  const { eventAlertsSmsEnabled, emergencyAnnouncementsSmsEnabled } = req.validated as SmsPushSubscriptionPayload;
  const updates: Parameters<typeof updateUserProfile>[1] = {};
  if (typeof eventAlertsSmsEnabled === 'boolean') {
    updates.event_alerts_sms_enabled = eventAlertsSmsEnabled ? 1 : 0;
  }
  if (typeof emergencyAnnouncementsSmsEnabled === 'boolean') {
    updates.emergency_announcements_sms_enabled = emergencyAnnouncementsSmsEnabled ? 1 : 0;
  }
  const updated = updateUserProfile(user.id, updates);
  if (!updated) {
    throw new Error('Failed to update user SMS subscription');
  }
  const token = signToken(updated);
  return res.json({ token, user: toPublicUser(updated) });
}

/**
 * Registers or updates the Expo push subscription for the current user.
 */
export const upsertPushSubscriptionHandler: RequestHandler = (req: AuthedRequest, res) => {
  const user = req.user as RequestUser;
  const { token, announcementAlertsEnabled, eventAlertsEnabled } = req.validated as PushSubscriptionPayload;
  const subscription = upsertPushSubscription(user.id, token, {
    announcementAlertsEnabled: typeof announcementAlertsEnabled === 'boolean' ? announcementAlertsEnabled : undefined,
    eventAlertsEnabled: typeof eventAlertsEnabled === 'boolean' ? eventAlertsEnabled : undefined,
  });
  return res.status(201).json({ subscription: serializePushSubscription(subscription) });
};

/**
 * Returns the current push subscription for the authenticated user.
 */
export const getPushSubscriptionHandler: RequestHandler = (req: AuthedRequest, res) => {
  const user = req.user as RequestUser;
  const existing = findPushSubscriptionByUserId(user.id);
  return res.json({ subscription: existing ? serializePushSubscription(existing) : null });
};

/**
 * Deletes the current user's push subscription.
 */
export const deletePushSubscriptionHandler: RequestHandler = (req: AuthedRequest, res) => {
  const user = req.user as RequestUser;
  deletePushSubscription(user.id);
  return res.status(204).send();
};

/**
 * Lists users (admin only) with optional search query.
 */
export const listUsersHandler: RequestHandler = (req, res) => {
  const { q } = (req.validatedQuery ?? {}) as UserListQueryPayload;
  const users = listUsers(q).map(toPublicUser);
  return res.json({ users });
};

/**
 * Updates a user's role (admin only) while preventing self-demotion.
 */
export const updateUserRoleHandler: RequestHandler = (req: AuthedRequest, res) => {
  const { role } = req.validated as UserRolePayload;
  const { id } = req.validatedQuery as UserIdParamPayload;
  const user = req.user as RequestUser;
  if (user.id === id) {
    return res.status(400).json({ error: 'You cannot change your own role' });
  }
  const updated = updateUserRole(id, role);
  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({ user: toPublicUser(updated) });
};

/**
 * Syncs scheduled events from Discord into the local database (admin only).
 */
export const syncDiscordHandler: RequestHandler = (_req, res) => {
  void syncDiscordEvents()
    .then((result) => {
      res.json({ synced: result.count, skipped: result.skipped });
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : 'Failed to sync Discord events';
      res.status(500).json({ error: message });
    });
};
