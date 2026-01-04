import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../helpers';

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

const { messagesCreate } = vi.hoisted(() => ({
  messagesCreate: vi.fn(),
}));

vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    messages: {
      create: messagesCreate,
    },
  })),
}));

type CleanupFn = () => Promise<void>;

/**
 * Captures and restores a small set of env vars for push tests.
 */
const captureEnv = () => ({
  EXPO_PUSH_ACCESS_TOKEN: process.env.EXPO_PUSH_ACCESS_TOKEN,
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
});

/**
 * Restores environment variables from a snapshot.
 */
const restoreEnv = (snapshot: Record<string, string | undefined>) => {
  Object.entries(snapshot).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
};

/**
 * Builds a future ISO timestamp offset from now.
 */
const futureIso = (minutesFromNow: number) => new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();

describe('push service integration', () => {
  let cleanup: CleanupFn;
  let sendAnnouncementPush: (body: string) => Promise<void>;
  let processEventAlertNotifications: () => Promise<void>;
  let processEventAlertSMSNotifications: () => Promise<void>;
  let createUser: (email: string | null, username: string, passwordHash: string, role: 'user' | 'admin') => { id: number };
  let updateUserProfile: (
    id: number,
    updates: { phone?: string | null; event_alerts_sms_enabled?: number }
  ) => { id: number } | undefined;
  let createWorkingGroup: (name: string, description: string, members: string) => { id: number };
  let createEvent: (
    name: string,
    description: string,
    workingGroupId: number,
    startAt: string,
    endAt: string,
    location: string,
    locationDisplayName: string | null,
    seriesUuid: string | null,
    recurrenceRule: string | null,
    seriesEndAt: string | null
  ) => { id: number };
  let addEventAttendee: (userId: number, eventId: number) => void;
  let upsertPushSubscription: (
    userId: number,
    token: string,
    options?: { announcementAlertsEnabled?: boolean; eventAlertsEnabled?: boolean }
  ) => void;
  let upsertWebPushSubscription: (userId: number, endpoint: string, p256dh: string, auth: string) => void;
  let hasEventNotificationLog: (
    eventId: number,
    userId: number,
    notificationType: 'day-of' | 'hour-before' | 'sms-day-of' | 'sms-hour-before'
  ) => boolean;
  let envSnapshot: Record<string, string | undefined>;

  /**
   * Boots a fresh app/database and loads push service dependencies.
   */
  beforeEach(async () => {
    envSnapshot = captureEnv();
    process.env.EXPO_PUSH_ACCESS_TOKEN = 'test-expo-token';
    process.env.VAPID_PUBLIC_KEY = 'test-vapid-public';
    process.env.VAPID_PRIVATE_KEY = 'test-vapid-private';
    process.env.TWILIO_ACCOUNT_SID = 'test-twilio-sid';
    process.env.TWILIO_AUTH_TOKEN = 'test-twilio-auth';
    process.env.TWILIO_PHONE_NUMBER = '+15550001111';
    messagesCreate.mockReset();

    vi.resetModules();
    const setup = await createTestApp();
    cleanup = setup.cleanup;

    ({ sendAnnouncementPush, processEventAlertNotifications, processEventAlertSMSNotifications } =
      await import('../../src/services/pushService'));
    ({ createUser, updateUserProfile } = await import('../../src/repositories/userRepository'));
    ({ createWorkingGroup } = await import('../../src/repositories/workingGroupRepository'));
    ({ createEvent, addEventAttendee } = await import('../../src/repositories/eventRepository'));
    ({ upsertPushSubscription } = await import('../../src/repositories/pushSubscriptionRepository'));
    ({ hasEventNotificationLog } = await import('../../src/repositories/notificationRepository'));
  });

  /**
   * Cleans up temp data, mocks, and env overrides.
   */
  afterEach(async () => {
    await cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    restoreEnv(envSnapshot);
  });

  /**
   * @given announcement and web push subscribers
   * @when sendAnnouncementPush is invoked
   * @then the announcement is sent to enabled push tokens and web endpoints
   */
  it('sends announcement notifications to enabled subscribers', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch);

    const userA = createUser('announce-a@example.com', 'announce-a', 'hash', 'user');
    const userB = createUser('announce-b@example.com', 'announce-b', 'hash', 'user');
    upsertPushSubscription(userA.id, 'token-a', { announcementAlertsEnabled: true });
    upsertPushSubscription(userB.id, 'token-b', { announcementAlertsEnabled: false });

    await sendAnnouncementPush('Hello members');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string) as Array<{
      to: string;
      title: string;
      body: string;
    }>;
    expect(requestBody).toEqual([
      {
        to: 'token-a',
        title: 'New announcement',
        body: 'Hello members',
      },
    ]);
  });

  /**
   * @given an attendee event within the alert window
   * @when processEventAlertNotifications runs
   * @then day-of and hour-before reminders are sent and logged
   */
  it('sends event alert notifications and logs them', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch);

    const user = createUser('alerts@example.com', 'alerts', 'hash', 'user');
    const group = createWorkingGroup('Alerts WG', 'Test working group', 'Members');
    const startAt = futureIso(30);
    const endAt = futureIso(90);
    const event = createEvent(
      'Upcoming meeting',
      'Event with alerts',
      group.id,
      startAt,
      endAt,
      'Conference room',
      null,
      null,
      null,
      null
    );
    addEventAttendee(user.id, event.id);
    upsertPushSubscription(user.id, 'alert-token', { eventAlertsEnabled: true });

    await processEventAlertNotifications();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string) as Array<{
      to: string;
      title: string;
      body: string;
    }>;
    expect(requestBody).toHaveLength(2);
    expect(hasEventNotificationLog(event.id, user.id, 'day-of')).toBe(true);
    expect(hasEventNotificationLog(event.id, user.id, 'hour-before')).toBe(true);
  });

  /**
   * @given an attendee event within the SMS alert window
   * @when processEventAlertSMSNotifications runs
   * @then day-of and hour-before SMS reminders are sent and logged
   */
  it('sends SMS event alerts and logs them', async () => {
    const user = createUser('sms@example.com', 'sms', 'hash', 'user');
    updateUserProfile(user.id, { phone: '+15551234567', event_alerts_sms_enabled: 1 });
    const group = createWorkingGroup('SMS WG', 'Test working group', 'Members');
    const startAt = futureIso(30);
    const endAt = futureIso(90);
    const event = createEvent(
      'Upcoming SMS meeting',
      'Event with SMS alerts',
      group.id,
      startAt,
      endAt,
      'Conference room',
      null,
      null,
      null,
      null
    );
    addEventAttendee(user.id, event.id);

    await processEventAlertSMSNotifications();

    expect(messagesCreate).toHaveBeenCalledTimes(2);
    expect(messagesCreate).toHaveBeenCalledWith({
      from: '+15550001111',
      to: '+15551234567',
      body: 'Reminder: Upcoming SMS meeting is happening within the next 24 hours.',
    });
    expect(messagesCreate).toHaveBeenCalledWith({
      from: '+15550001111',
      to: '+15551234567',
      body: 'You have an event starting soon: Upcoming SMS meeting.',
    });
    expect(hasEventNotificationLog(event.id, user.id, 'sms-day-of')).toBe(true);
    expect(hasEventNotificationLog(event.id, user.id, 'sms-hour-before')).toBe(true);
  });
});
