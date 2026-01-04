import { ValidationError } from '../middleware/validate';
import { Schema } from './types';

export type PushSubscriptionPayload = {
  token: string;
  announcementAlertsEnabled?: boolean;
  eventAlertsEnabled?: boolean;
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
