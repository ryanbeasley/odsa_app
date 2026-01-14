import { ValidationError } from '../middleware/validate';
import { Schema } from './types';

export type PushSubscriptionPayload = {
  token: string;
  announcementAlertsEnabled?: boolean;
  eventAlertsEnabled?: boolean;
};

export type SmsPushSubscriptionPayload = {
  eventAlertsSmsEnabled?: boolean;
  emergencyAnnouncementsSmsEnabled?: boolean;
};

export const pushSubscriptionSchema: Schema<PushSubscriptionPayload> = {
  parse(input: unknown) {
    const { token, announcementAlertsEnabled, eventAlertsEnabled } = (input ?? {}) as Record<string, unknown>;
    if (typeof token !== 'string' || !token.trim()) {
      throw new ValidationError('token is required');
    }
    if (announcementAlertsEnabled !== undefined && typeof announcementAlertsEnabled !== 'boolean') {
      throw new ValidationError('announcementAlertsEnabled must be a boolean');
    }
    if (eventAlertsEnabled !== undefined && typeof eventAlertsEnabled !== 'boolean') {
      throw new ValidationError('eventAlertsEnabled must be a boolean');
    }
    return {
      token: token.trim(),
      announcementAlertsEnabled: announcementAlertsEnabled as boolean | undefined,
      eventAlertsEnabled: eventAlertsEnabled as boolean | undefined,
    };
  },
};

export const smsPushSubscriptionSchema: Schema<SmsPushSubscriptionPayload> = {
  parse(input: unknown) {
    const { eventAlertsSmsEnabled, emergencyAnnouncementsSmsEnabled } = (input ?? {}) as Record<string, unknown>;
    if (eventAlertsSmsEnabled === undefined && emergencyAnnouncementsSmsEnabled === undefined) {
      throw new ValidationError('eventAlertsSmsEnabled or emergencyAnnouncementsSmsEnabled is required');
    }
    if (eventAlertsSmsEnabled !== undefined && typeof eventAlertsSmsEnabled !== 'boolean') {
      throw new ValidationError('eventAlertsSmsEnabled must be a boolean');
    }
    if (emergencyAnnouncementsSmsEnabled !== undefined && typeof emergencyAnnouncementsSmsEnabled !== 'boolean') {
      throw new ValidationError('emergencyAnnouncementsSmsEnabled must be a boolean');
    }
    return {
      eventAlertsSmsEnabled: eventAlertsSmsEnabled as boolean | undefined,
      emergencyAnnouncementsSmsEnabled: emergencyAnnouncementsSmsEnabled as boolean | undefined,
    };
  },
};

export type UserRolePayload = {
  role: 'user' | 'admin';
};

export const userRoleSchema: Schema<UserRolePayload> = {
  parse(input: unknown) {
    const { role } = (input ?? {}) as Record<string, unknown>;
    if (role !== 'user' && role !== 'admin') {
      throw new ValidationError('role must be user or admin');
    }
    return { role };
  },
};
