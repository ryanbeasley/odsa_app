import { describe, expect, it } from 'vitest';
import { profileUpdateSchema } from '../../src/validation/userSchemas';

type RequestLike = { user?: { email: string | null; username: string } };

describe('userSchemas', () => {
  it('rejects profile updates without an authenticated user', () => {
    expect(() => profileUpdateSchema.parse({}, {})).toThrow('Unauthorized');
  });

  it('parses profile updates and normalizes values', () => {
    const req: RequestLike = { user: { email: 'user@example.com', username: 'user' } };
    const result = profileUpdateSchema.parse(
      {
        firstName: ' Test ',
        lastName: ' User ',
        phone: '(415) 555-0123',
        email: 'USER@Example.com',
        eventAlertsSmsEnabled: true,
        emergencyAnnouncementsSmsEnabled: true,
        username: 'NewUser',
      },
      req
    );

    expect(result).toEqual({
      first_name: 'Test',
      last_name: 'User',
      phone: '+14155550123',
      email: 'user@example.com',
      event_alerts_sms_enabled: 1,
      emergency_announcements_sms_enabled: 1,
      username: 'newuser',
    });
  });

  it('rejects invalid profile update payloads', () => {
    const req: RequestLike = { user: { email: 'user@example.com', username: 'user' } };
    expect(() => profileUpdateSchema.parse({ firstName: 123 }, req)).toThrow('First name must be a string');
    expect(() => profileUpdateSchema.parse({ phone: '123' }, req)).toThrow(
      'Phone must be a valid E.164 number (e.g. +14075551234)'
    );
    expect(() => profileUpdateSchema.parse({ username: '!!' }, req)).toThrow(
      'Username must be 3-32 characters (letters, numbers, . _ -)'
    );
    expect(() => profileUpdateSchema.parse({ email: 'bad' }, req)).toThrow('Email is invalid');
  });
});
