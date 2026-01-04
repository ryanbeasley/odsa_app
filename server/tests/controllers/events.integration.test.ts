import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../helpers';
import { DiscordRecurrenceFrequency, DiscordWeekday } from '../../src/services/discordTypes';

vi.mock('../../src/services/discordService', () => ({
  createDiscordEventFromApp: vi.fn(async () => 'discord-123'),
  updateDiscordEventFromApp: vi.fn(async () => {}),
}));

import { createDiscordEventFromApp, updateDiscordEventFromApp } from '../../src/services/discordService';

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
  let userToken: string;
  let workingGroupId: number;

  const createUserToken = async (username: string) => {
    const response = await request(app).post('/api/signup').send({
      username,
      password: 'password123',
    });
    return response.body.token as string;
  };

  const createWorkingGroup = async (name = 'Test WG') => {
    const response = await request(app)
      .post('/api/working-groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name,
        description: 'Working group for tests',
        members: 'Testers',
      });
    return response.body.group.id as number;
  };

  const createEvent = async (payload: Record<string, unknown>) => {
    return request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
  };

  const fetchEventByName = async (name: string, token = userToken) => {
    const response = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${token}`);
    return response.body.events.find((event: { name: string }) => event.name === name);
  };

  /**
   * Boots the test app and seeds a working group for event creation.
   */
  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    cleanup = setup.cleanup;
    adminToken = await setup.getAdminToken();
    userToken = await createUserToken('events-user');
    workingGroupId = await createWorkingGroup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('manages working groups with admin access', async () => {
    const unauthorized = await request(app).get('/api/working-groups');
    expect(unauthorized.status).toBe(401);

    const createdId = await createWorkingGroup('Second WG');
    const list = await request(app)
      .get('/api/working-groups')
      .set('Authorization', `Bearer ${userToken}`);
    expect(list.status).toBe(200);
    expect(list.body.groups.find((group: { id: number }) => group.id === createdId)).toBeDefined();

    const invalidUpdate = await request(app)
      .patch('/api/working-groups/0')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Updated',
        description: 'Updated',
        members: 'Updated',
      });
    expect(invalidUpdate.status).toBe(400);

    const notFoundUpdate = await request(app)
      .patch('/api/working-groups/9999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Updated',
        description: 'Updated',
        members: 'Updated',
      });
    expect(notFoundUpdate.status).toBe(404);

    const updated = await request(app)
      .patch(`/api/working-groups/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Updated',
        description: 'Updated',
        members: 'Updated',
      });
    expect(updated.status).toBe(200);
    expect(updated.body.group.name).toBe('Updated');

    const invalidDelete = await request(app)
      .delete('/api/working-groups/0')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalidDelete.status).toBe(400);

    const missingDelete = await request(app)
      .delete('/api/working-groups/9999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(missingDelete.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/working-groups/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(204);
  });

  it('validates event creation payloads', async () => {
    const invalid = await createEvent({
      description: 'Missing name',
      workingGroupId,
      startAt: '2025-01-01T10:00:00.000Z',
      endAt: '2025-01-01T11:00:00.000Z',
      location: 'HQ',
    });
    expect(invalid.status).toBe(400);

    const invalidDates = await createEvent({
      name: 'Bad dates',
      description: 'Invalid',
      workingGroupId,
      startAt: '2025-01-01T12:00:00.000Z',
      endAt: '2025-01-01T11:00:00.000Z',
      location: 'HQ',
    });
    expect(invalidDates.status).toBe(400);
  });

  it('creates single events and updates Discord when requested', async () => {
    const startAt = '2099-01-01T10:00:00.000Z';
    const endAt = '2099-01-01T11:00:00.000Z';
    const created = await createEvent({
      name: 'Single Event',
      description: 'Single',
      workingGroupId,
      startAt,
      endAt,
      location: 'HQ',
      createDiscordEvent: true,
    });
    expect(created.status).toBe(201);
    expect(created.body.event.name).toBe('Single Event');
    expect(created.body.event.discordEventId).toBe('discord-123');
    expect(createDiscordEventFromApp).toHaveBeenCalledTimes(1);

    const patch = await request(app)
      .patch(`/api/events/${created.body.event.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Single Event Updated',
        description: 'Updated',
        workingGroupId,
        startAt,
        endAt,
        location: 'HQ',
        createDiscordEvent: true,
      });
    expect(patch.status).toBe(200);
    expect(patch.body.event.discordEventId).toBe('discord-123');
    expect(createDiscordEventFromApp).toHaveBeenCalledTimes(1);
    expect(updateDiscordEventFromApp).toHaveBeenCalledTimes(1);
  });

  it('returns grouped upcoming events with attendance info', async () => {
    const startAt = '2099-02-01T10:00:00.000Z';
    const endAt = '2099-02-01T11:00:00.000Z';
    const created = await createEvent({
      name: 'Attendance Event',
      description: 'Attendance',
      workingGroupId,
      startAt,
      endAt,
      location: 'HQ',
    });
    expect(created.status).toBe(201);

    const beforeAttend = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${userToken}`);
    const target = beforeAttend.body.events.find((event: { name: string }) => event.name === 'Attendance Event');
    expect(target.attending).toBe(false);
    expect(target.upcomingOccurrences[0].attending).toBe(false);

    const attend = await request(app)
      .post(`/api/events/${created.body.event.id}/attendees`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(attend.status).toBe(201);

    const afterAttend = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${userToken}`);
    const attended = afterAttend.body.events.find((event: { name: string }) => event.name === 'Attendance Event');
    expect(attended.attending).toBe(true);
    expect(attended.upcomingOccurrences[0].attendeeCount).toBe(1);
  });

  it('manages series attendees and deletions', async () => {
    const startAt = '2099-03-01T10:00:00.000Z';
    const endAt = '2099-03-01T11:00:00.000Z';
    const seriesEndAt = '2099-03-03T10:00:00.000Z';
    const created = await createEvent({
      name: 'Series Event',
      description: 'Series',
      workingGroupId,
      startAt,
      endAt,
      location: 'HQ',
      recurrenceRule: {
        frequency: DiscordRecurrenceFrequency.DAILY,
        interval: 1,
      },
      seriesEndAt,
    });
    expect(created.status).toBe(201);

    const seriesEvent = await fetchEventByName('Series Event');
    expect(seriesEvent.upcomingOccurrences.length).toBe(3);

    const attend = await request(app)
      .post(`/api/events/${created.body.event.id}/attendees`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ series: true });
    expect(attend.status).toBe(201);

    const afterAttend = await fetchEventByName('Series Event');
    expect(afterAttend.attending).toBe(true);
    expect(afterAttend.upcomingOccurrences.every((occ: { attending: boolean }) => occ.attending)).toBe(true);

    const remove = await request(app)
      .delete(`/api/events/${created.body.event.id}/attendees`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ series: true });
    expect(remove.status).toBe(204);

    const afterRemove = await fetchEventByName('Series Event');
    expect(afterRemove.attending).toBe(false);

    const deleteSeries = await request(app)
      .delete(`/api/events/${created.body.event.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ series: true });
    expect(deleteSeries.status).toBe(204);
    const afterDelete = await fetchEventByName('Series Event');
    expect(afterDelete).toBeUndefined();
  });

  it('regenerates series and updates single events', async () => {
    const startAt = '2099-04-01T10:00:00.000Z';
    const endAt = '2099-04-01T11:00:00.000Z';
    const created = await createEvent({
      name: 'Regenerate Event',
      description: 'Regenerate',
      workingGroupId,
      startAt,
      endAt,
      location: 'HQ',
    });
    expect(created.status).toBe(201);

    const regen = await request(app)
      .patch(`/api/events/${created.body.event.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Regenerate Event',
        description: 'Regenerate',
        workingGroupId,
        startAt,
        endAt,
        location: 'HQ',
        recurrenceRule: {
          frequency: DiscordRecurrenceFrequency.WEEKLY,
          by_weekday: [DiscordWeekday.MONDAY],
        },
        seriesEndAt: '2099-04-15T10:00:00.000Z',
      });
    expect(regen.status).toBe(200);
    expect(regen.body.event.seriesUuid).toBeTruthy();
    expect(regen.body.event.recurrenceRule.frequency).toBe(DiscordRecurrenceFrequency.WEEKLY);

    const singleStartAt = '2099-04-20T10:00:00.000Z';
    const singleEndAt = '2099-04-20T11:00:00.000Z';
    const singleCreated = await createEvent({
      name: 'Single Update Event',
      description: 'Single',
      workingGroupId,
      startAt: singleStartAt,
      endAt: singleEndAt,
      location: 'HQ',
    });
    expect(singleCreated.status).toBe(201);

    const updateSingle = await request(app)
      .patch(`/api/events/${singleCreated.body.event.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Single Update Event',
        description: 'Updated',
        workingGroupId,
        startAt: singleStartAt,
        endAt: singleEndAt,
        location: 'HQ',
      });
    expect(updateSingle.status).toBe(200);
    expect(updateSingle.body.event.seriesUuid).toBeNull();
  });

  it('rejects attendee updates for invalid events', async () => {
    const missing = await request(app)
      .post('/api/events/9999/attendees')
      .set('Authorization', `Bearer ${userToken}`);
    expect(missing.status).toBe(404);

    const invalidId = await request(app)
      .delete('/api/events/0/attendees')
      .set('Authorization', `Bearer ${userToken}`);
    expect(invalidId.status).toBe(400);
  });

  it('deletes single events', async () => {
    const startAt = '2099-05-01T10:00:00.000Z';
    const endAt = '2099-05-01T11:00:00.000Z';
    const created = await createEvent({
      name: 'Delete Event',
      description: 'Delete',
      workingGroupId,
      startAt,
      endAt,
      location: 'HQ',
    });
    expect(created.status).toBe(201);

    const deleted = await request(app)
      .delete(`/api/events/${created.body.event.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleted.status).toBe(204);

    const afterDelete = await fetchEventByName('Delete Event');
    expect(afterDelete).toBeUndefined();
  });
});
