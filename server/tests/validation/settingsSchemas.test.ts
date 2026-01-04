import { describe, expect, it } from 'vitest';
import { pushSubscriptionSchema, userRoleSchema } from '../../src/validation/settingsSchemas';

describe('settingsSchemas', () => {
  it('parses push subscription payloads', () => {
    const result = pushSubscriptionSchema.parse({
      token: 'token',
      announcementAlertsEnabled: true,
      eventAlertsEnabled: false,
    });
    expect(result).toEqual({
      token: 'token',
      announcementAlertsEnabled: true,
      eventAlertsEnabled: false,
    });
  });

  it('rejects invalid push subscription payloads', () => {
    expect(() => pushSubscriptionSchema.parse({})).toThrow('token is required');
    expect(() => pushSubscriptionSchema.parse({ token: 'token', eventAlertsEnabled: 'yes' })).toThrow(
      'eventAlertsEnabled must be a boolean'
    );
  });

  it('parses user role payloads', () => {
    expect(userRoleSchema.parse({ role: 'admin' })).toEqual({ role: 'admin' });
    expect(userRoleSchema.parse({ role: 'user' })).toEqual({ role: 'user' });
  });

  it('rejects invalid user role payloads', () => {
    expect(() => userRoleSchema.parse({ role: 'other' })).toThrow('role must be user or admin');
  });
});
