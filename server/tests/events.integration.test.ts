import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers';
import { DiscordRecurrenceFrequency, DiscordWeekday } from '../src/services/discordTypes';

/**
 * Maps a Discord weekday index to the JavaScript weekday index.
 */
const discordWeekdayToJs = (weekday: number) => (weekday === DiscordWeekday.SUNDAY ? 0 : weekday + 1);

/**
 * Finds the next future date matching the requested weekday.
 */
const futureWeekdayStart = (weekday: number) => {
  const jsWeekday = discordWeekdayToJs(weekday);
  const start = new Date(Date.UTC(2099, 0, 1, 15, 0, 0));
  while (start.getUTCDay() !== jsWeekday) {
    start.setUTCDate(start.getUTCDate() + 1);
  }
  return start;
};

describe('events integration', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let cleanup: Awaited<ReturnType<typeof createTestApp>>['cleanup'];
  let adminToken: string;
  let workingGroupId: number;

  /**
   * Boots the test app and seeds a working group for event creation.
   */
  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    cleanup = setup.cleanup;
    adminToken = await setup.getAdminToken();

    const groupRes = await request(app)
      .post('/api/working-groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test WG',
        description: 'Working group for tests',
        members: 'Testers',
      });

    workingGroupId = groupRes.body.group.id;
  });

  /**
   * Tears down the test app and related resources.
   */
  afterAll(async () => {
    await cleanup();
  });

  /**
   * @given a future monthly by-n-weekday recurrence rule
   * @when the event is created via the API
   * @then the stored recurrence rule matches the requested rule
   */
  it('stores and returns a monthly by-n-weekday recurrence rule', async () => {
    const startAt = futureWeekdayStart(DiscordWeekday.WEDNESDAY);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
    const seriesEndAt = new Date(startAt.getTime());
    seriesEndAt.setUTCMonth(seriesEndAt.getUTCMonth() + 2);

    const response = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Monthly planning',
        description: 'Monthly planning meeting',
        workingGroupId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        location: 'Community Hall',
        recurrenceRule: {
          frequency: DiscordRecurrenceFrequency.MONTHLY,
          interval: 1,
          by_n_weekday: [{ n: 1, day: DiscordWeekday.WEDNESDAY }],
        },
        seriesEndAt: seriesEndAt.toISOString(),
      });

    expect(response.status).toBe(201);
    expect(response.body.event.recurrenceRule.frequency).toBe(DiscordRecurrenceFrequency.MONTHLY);
    expect(response.body.event.recurrenceRule.by_n_weekday[0]).toEqual({ n: 1, day: DiscordWeekday.WEDNESDAY });
    expect(response.body.event.recurrenceRule.start).toBe(startAt.toISOString());
    expect(JSON.stringify(response.body.event.recurrenceRule)).toBe(
      JSON.stringify({
        start: startAt.toISOString(),
        frequency: DiscordRecurrenceFrequency.MONTHLY,
        interval: 1,
        by_n_weekday: [{ n: 1, day: DiscordWeekday.WEDNESDAY }],
      })
    );
  });

  /**
   * @given a daily recurrence rule filtered to weekdays
   * @when the event is created and events are listed
   * @then upcoming occurrences only include weekday instances
   */
  it('expands daily rules using weekday filters', async () => {
    const startAt = futureWeekdayStart(DiscordWeekday.MONDAY);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
    const seriesEndAt = new Date(startAt.getTime());
    seriesEndAt.setUTCDate(seriesEndAt.getUTCDate() + 6);

    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Weekday standup',
        description: 'Daily standup',
        workingGroupId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        location: 'Office',
        recurrenceRule: {
          frequency: DiscordRecurrenceFrequency.DAILY,
          interval: 1,
          by_weekday: [
            DiscordWeekday.MONDAY,
            DiscordWeekday.TUESDAY,
            DiscordWeekday.WEDNESDAY,
            DiscordWeekday.THURSDAY,
            DiscordWeekday.FRIDAY,
          ],
        },
        seriesEndAt: seriesEndAt.toISOString(),
      });

    expect(createRes.status).toBe(201);
    expect(JSON.stringify(createRes.body.event.recurrenceRule)).toBe(
      JSON.stringify({
        start: startAt.toISOString(),
        frequency: DiscordRecurrenceFrequency.DAILY,
        interval: 1,
        by_weekday: [
          DiscordWeekday.MONDAY,
          DiscordWeekday.TUESDAY,
          DiscordWeekday.WEDNESDAY,
          DiscordWeekday.THURSDAY,
          DiscordWeekday.FRIDAY,
        ],
      })
    );

    const listRes = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${adminToken}`);

    const target = listRes.body.events.find((event: { name: string }) => event.name === 'Weekday standup');
    expect(target).toBeDefined();
    expect(target.upcomingOccurrences.length).toBe(5);
  });

  /**
   * @given a one-off event without a recurrence rule
   * @when the event is created via the API
   * @then the response returns a null recurrenceRule
   */
  it('returns null recurrenceRule when none is provided', async () => {
    const startAt = new Date(Date.UTC(2099, 5, 1, 12, 0, 0));
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

    const response = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'One-off event',
        description: 'Single event',
        workingGroupId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        location: 'Main hall',
      });

    expect(response.status).toBe(201);
    expect(response.body.event.recurrenceRule).toBeNull();
  });
});
