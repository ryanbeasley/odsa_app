import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventRow } from '../../src/types';
import { DiscordEntityType, DiscordRecurrenceFrequency, DiscordWeekday } from '../../src/services/discordTypes';

type EventRepoMocks = {
  createEvent: ReturnType<typeof vi.fn>;
  deleteEventById: ReturnType<typeof vi.fn>;
  deleteEventsBySeries: ReturnType<typeof vi.fn>;
  findEventByDiscordEventId: ReturnType<typeof vi.fn>;
  upsertDiscordEvent: ReturnType<typeof vi.fn>;
  updateEventDiscordId: ReturnType<typeof vi.fn>;
};

type WorkingGroupMocks = {
  findWorkingGroupById: ReturnType<typeof vi.fn>;
  findWorkingGroupByName: ReturnType<typeof vi.fn>;
};

type SetupResult = {
  repoMocks: EventRepoMocks;
  groupMocks: WorkingGroupMocks;
  syncDiscordEvents: typeof import('../../src/services/discordService').syncDiscordEvents;
  createDiscordEventFromApp: typeof import('../../src/services/discordService').createDiscordEventFromApp;
  updateDiscordEventFromApp: typeof import('../../src/services/discordService').updateDiscordEventFromApp;
};

async function setupDiscordService(overrides?: { token?: string; guildId?: string }) {
  const repoMocks: EventRepoMocks = {
    createEvent: vi.fn(),
    deleteEventById: vi.fn(),
    deleteEventsBySeries: vi.fn(),
    findEventByDiscordEventId: vi.fn(),
    upsertDiscordEvent: vi.fn(),
    updateEventDiscordId: vi.fn(),
  };
  const groupMocks: WorkingGroupMocks = {
    findWorkingGroupById: vi.fn(),
    findWorkingGroupByName: vi.fn(),
  };

  vi.resetModules();
  vi.doMock('../../src/config/env', () => ({
    DISCORD_BOT_TOKEN: overrides?.token ?? 'token',
    DISCORD_GUILD_ID: overrides?.guildId ?? 'guild',
  }));
  vi.doMock('../../src/repositories/eventRepository', () => repoMocks);
  vi.doMock('../../src/repositories/workingGroupRepository', () => groupMocks);

  const module = await import('../../src/services/discordService');
  return {
    repoMocks,
    groupMocks,
    syncDiscordEvents: module.syncDiscordEvents,
    createDiscordEventFromApp: module.createDiscordEventFromApp,
    updateDiscordEventFromApp: module.updateDiscordEventFromApp,
  } satisfies SetupResult;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('discordService', () => {
  const originalLogEnter = console.logEnter;

  beforeEach(() => {
    console.logEnter = (() => {}) as typeof console.logEnter;
  });

  afterEach(() => {
    if (originalLogEnter) {
      console.logEnter = originalLogEnter;
    }
  });

  it('throws when Discord is not configured', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { syncDiscordEvents } = await setupDiscordService({ token: '', guildId: '' });

    await expect(syncDiscordEvents()).rejects.toThrow('Discord is not configured');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('syncs a single event and upserts it', async () => {
    const events = [
      {
        id: 'evt-1',
        name: 'Weekly Meeting',
        description: 'Agenda\n\n```working-group-id=WG```',
        scheduled_start_time: '2024-01-01T10:00:00.000Z',
        scheduled_end_time: '2024-01-01T11:00:00.000Z',
        entity_type: DiscordEntityType.EXTERNAL,
        entity_metadata: { location: 'Community Center' },
        channel_id: null,
        recurrence_rule: null,
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => events,
      })
    );
    const { syncDiscordEvents, repoMocks, groupMocks } = await setupDiscordService();
    groupMocks.findWorkingGroupByName.mockReturnValue({ id: 9, name: 'WG' });

    const result = await syncDiscordEvents();

    expect(result).toEqual({ count: 1, skipped: 0 });
    expect(repoMocks.upsertDiscordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        discordEventId: 'evt-1',
        workingGroupId: 9,
        location: 'https://maps.google.com/?q=Community%20Center',
        locationDisplayName: 'Community Center',
      })
    );
    expect(repoMocks.createEvent).not.toHaveBeenCalled();
  });

  it('skips events with missing start times, invalid dates, or missing groups', async () => {
    const events = [
      {
        id: 'evt-missing-start',
        name: 'No Start',
        description: null,
        scheduled_start_time: '',
        scheduled_end_time: null,
        entity_type: DiscordEntityType.EXTERNAL,
        entity_metadata: { location: null },
      },
      {
        id: 'evt-invalid-start',
        name: 'Bad Start',
        description: '```working-group-id=WG```',
        scheduled_start_time: 'not-a-date',
        scheduled_end_time: null,
        entity_type: DiscordEntityType.EXTERNAL,
        entity_metadata: { location: 'HQ' },
      },
      {
        id: 'evt-missing-group',
        name: 'Missing Group',
        description: '```working-group-id=Unknown```',
        scheduled_start_time: '2024-01-01T10:00:00.000Z',
        scheduled_end_time: null,
        entity_type: DiscordEntityType.EXTERNAL,
        entity_metadata: { location: 'HQ' },
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => events,
      })
    );
    const { syncDiscordEvents, repoMocks, groupMocks } = await setupDiscordService();
    groupMocks.findWorkingGroupByName.mockReturnValue(null);

    const result = await syncDiscordEvents();

    expect(result).toEqual({ count: 0, skipped: 3 });
    expect(repoMocks.upsertDiscordEvent).not.toHaveBeenCalled();
    expect(repoMocks.createEvent).not.toHaveBeenCalled();
  });

  it('skips events with unsupported intervals', async () => {
    const events = [
      {
        id: 'evt-interval',
        name: 'Every Other Day',
        description: '```working-group-id=WG```',
        scheduled_start_time: '2024-01-01T10:00:00.000Z',
        scheduled_end_time: '2024-01-01T11:00:00.000Z',
        entity_type: DiscordEntityType.EXTERNAL,
        entity_metadata: { location: 'HQ' },
        recurrence_rule: {
          start: '2024-01-01T10:00:00.000Z',
          end: '2024-01-05T10:00:00.000Z',
          frequency: DiscordRecurrenceFrequency.DAILY,
          interval: 2,
        },
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => events,
      })
    );
    const { syncDiscordEvents, repoMocks, groupMocks } = await setupDiscordService();
    groupMocks.findWorkingGroupByName.mockReturnValue({ id: 9, name: 'WG' });

    const result = await syncDiscordEvents();

    expect(result).toEqual({ count: 0, skipped: 1 });
    expect(repoMocks.upsertDiscordEvent).not.toHaveBeenCalled();
    expect(repoMocks.createEvent).not.toHaveBeenCalled();
  });

  it('builds location details for external links and Discord channels', async () => {
    const events = [
      {
        id: 'evt-http',
        name: 'HTTP Link',
        description: '```working-group-id=WG```',
        scheduled_start_time: '2024-01-01T10:00:00.000Z',
        scheduled_end_time: null,
        entity_type: DiscordEntityType.EXTERNAL,
        entity_metadata: { location: 'https://example.com/event' },
        channel_id: null,
        recurrence_rule: null,
      },
      {
        id: 'evt-stage',
        name: 'Stage Event',
        description: '```working-group-id=WG```',
        scheduled_start_time: '2024-01-02T10:00:00.000Z',
        scheduled_end_time: null,
        entity_type: DiscordEntityType.STAGE_INSTANCE,
        entity_metadata: null,
        channel_id: '12345',
        recurrence_rule: null,
      },
      {
        id: 'evt-default-location',
        name: 'Default Location',
        description: '```working-group-id=WG```',
        scheduled_start_time: '2024-01-02T12:00:00.000Z',
        scheduled_end_time: null,
        entity_type: DiscordEntityType.EXTERNAL,
        entity_metadata: null,
        channel_id: null,
        recurrence_rule: null,
      },
      {
        id: 'evt-voice',
        name: 'Voice Event',
        description: '```working-group-id=WG```',
        scheduled_start_time: '2024-01-03T10:00:00.000Z',
        scheduled_end_time: null,
        entity_type: DiscordEntityType.VOICE,
        entity_metadata: null,
        channel_id: null,
        recurrence_rule: null,
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => events,
      })
    );
    const { syncDiscordEvents, repoMocks, groupMocks } = await setupDiscordService();
    groupMocks.findWorkingGroupByName.mockReturnValue({ id: 9, name: 'WG' });

    const result = await syncDiscordEvents();

    expect(result).toEqual({ count: 4, skipped: 0 });
    expect(repoMocks.upsertDiscordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        discordEventId: 'evt-http',
        location: 'https://example.com/event',
        locationDisplayName: null,
        endAt: '2024-01-01T11:00:00.000Z',
      })
    );
    expect(repoMocks.upsertDiscordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        discordEventId: 'evt-stage',
        location: 'https://discord.com/channels/guild/12345',
        locationDisplayName: 'Discord stage',
      })
    );
    expect(repoMocks.upsertDiscordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        discordEventId: 'evt-default-location',
        location: 'https://maps.google.com/?q=Discord%20event',
        locationDisplayName: 'Discord event',
      })
    );
    expect(repoMocks.upsertDiscordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        discordEventId: 'evt-voice',
        location: 'https://discord.com/channels/guild',
        locationDisplayName: 'Discord voice',
      })
    );
  });

  it('skips events with unsupported recurrence rules', async () => {
    const events = [
      {
        id: 'evt-unsupported',
        name: 'Unsupported',
        description: '```working-group-id=WG```',
        scheduled_start_time: '2024-01-01T10:00:00.000Z',
        scheduled_end_time: '2024-01-01T11:00:00.000Z',
        entity_type: DiscordEntityType.EXTERNAL,
        entity_metadata: { location: 'https://example.com' },
        recurrence_rule: {
          start: '2024-01-01T10:00:00.000Z',
          frequency: DiscordRecurrenceFrequency.MONTHLY,
          interval: 1,
          by_weekday: [0, 1],
        },
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => events,
      })
    );
    const { syncDiscordEvents, repoMocks, groupMocks } = await setupDiscordService();
    groupMocks.findWorkingGroupByName.mockReturnValue({ id: 9, name: 'WG' });

    const result = await syncDiscordEvents();

    expect(result).toEqual({ count: 0, skipped: 1 });
    expect(repoMocks.upsertDiscordEvent).not.toHaveBeenCalled();
    expect(repoMocks.createEvent).not.toHaveBeenCalled();
  });

  it('creates series occurrences for supported recurrence rules', async () => {
    const events = [
      {
        id: 'evt-series',
        name: 'Daily Standup',
        description: '```working-group-id=WG```',
        scheduled_start_time: '2024-01-01T10:00:00.000Z',
        scheduled_end_time: '2024-01-01T11:00:00.000Z',
        entity_type: DiscordEntityType.EXTERNAL,
        entity_metadata: { location: 'HQ' },
        recurrence_rule: {
          start: '2024-01-01T10:00:00.000Z',
          end: '2024-01-03T10:00:00.000Z',
          frequency: DiscordRecurrenceFrequency.DAILY,
          interval: 1,
        },
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => events,
      })
    );
    const { syncDiscordEvents, repoMocks, groupMocks } = await setupDiscordService();
    groupMocks.findWorkingGroupByName.mockReturnValue({ id: 9, name: 'WG' });
    repoMocks.createEvent.mockReturnValue({ id: 1 } as EventRow);

    const result = await syncDiscordEvents();

    expect(result).toEqual({ count: 3, skipped: 0 });
    expect(repoMocks.createEvent).toHaveBeenCalledTimes(3);
    expect(repoMocks.updateEventDiscordId).toHaveBeenCalledTimes(1);
    expect(repoMocks.upsertDiscordEvent).not.toHaveBeenCalled();
    const expectedStartTimes = [
      '2024-01-01T10:00:00.000Z',
      '2024-01-02T10:00:00.000Z',
      '2024-01-03T10:00:00.000Z',
    ];
    const expectedEndTimes = [
      '2024-01-01T11:00:00.000Z',
      '2024-01-02T11:00:00.000Z',
      '2024-01-03T11:00:00.000Z',
    ];
    const seriesUuids = new Set<string>();
    const recurrenceRule = JSON.stringify(events[0].recurrence_rule);
    repoMocks.createEvent.mock.calls.forEach((call, index) => {
      const [
        name,
        description,
        workingGroupId,
        startAt,
        endAt,
        location,
        locationDisplayName,
        seriesUuid,
        recurrenceRuleValue,
        seriesEndAt,
      ] = call;
      expect(name).toBe('Daily Standup');
      expect(description).toBe('Discord event');
      expect(workingGroupId).toBe(9);
      expect(startAt).toBe(expectedStartTimes[index]);
      expect(endAt).toBe(expectedEndTimes[index]);
      expect(location).toBe('https://maps.google.com/?q=HQ');
      expect(locationDisplayName).toBe('HQ');
      seriesUuids.add(seriesUuid as string);
      expect(recurrenceRuleValue).toBe(recurrenceRule);
      expect(seriesEndAt).toBe('2024-01-03T11:00:00.000Z');
    });
    expect(seriesUuids.size).toBe(1);
  });

  it('filters daily recurrences by weekday', async () => {
    const events = [
      {
        id: 'evt-daily-filter',
        name: 'Sunday Only',
        description: '```working-group-id=WG```',
        scheduled_start_time: '2024-01-07T10:00:00.000Z',
        scheduled_end_time: '2024-01-07T11:00:00.000Z',
        entity_type: DiscordEntityType.EXTERNAL,
        entity_metadata: { location: 'HQ' },
        recurrence_rule: {
          start: '2024-01-07T10:00:00.000Z',
          end: '2024-01-09T10:00:00.000Z',
          frequency: DiscordRecurrenceFrequency.DAILY,
          interval: 1,
          by_weekday: [DiscordWeekday.SUNDAY],
        },
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => events,
      })
    );
    const { syncDiscordEvents, repoMocks, groupMocks } = await setupDiscordService();
    groupMocks.findWorkingGroupByName.mockReturnValue({ id: 9, name: 'WG' });
    repoMocks.createEvent.mockReturnValue({ id: 1 } as EventRow);

    const result = await syncDiscordEvents();

    expect(result).toEqual({ count: 0, skipped: 1 });
    expect(repoMocks.createEvent).toHaveBeenCalledTimes(0);
  });
  it('creates weekly series and replaces existing series events', async () => {
    const events = [
      {
        id: 'evt-weekly',
        name: 'Weekly Sync',
        description: '```working-group-id=WG```',
        scheduled_start_time: '2024-01-01T10:00:00.000Z',
        scheduled_end_time: '2024-01-01T11:00:00.000Z',
        entity_type: DiscordEntityType.EXTERNAL,
        entity_metadata: { location: 'HQ' },
        recurrence_rule: {
          start: '2024-01-01T10:00:00.000Z',
          end: '2024-01-15T12:00:00.000Z',
          frequency: DiscordRecurrenceFrequency.WEEKLY,
          interval: 1,
          by_weekday: [DiscordWeekday.MONDAY],
        },
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => events,
      })
    );
    const { syncDiscordEvents, repoMocks, groupMocks } = await setupDiscordService();
    groupMocks.findWorkingGroupByName.mockReturnValue({ id: 9, name: 'WG' });
    repoMocks.findEventByDiscordEventId.mockReturnValue({ id: 11, series_uuid: 'series-old' });
    repoMocks.createEvent.mockReturnValue({ id: 1 } as EventRow);

    const result = await syncDiscordEvents();

    expect(result).toEqual({ count: 3, skipped: 0 });
    expect(repoMocks.deleteEventsBySeries).toHaveBeenCalledWith('series-old');
    expect(repoMocks.createEvent).toHaveBeenCalledTimes(3);
    expect(repoMocks.updateEventDiscordId).toHaveBeenCalledTimes(1);
    const expectedStartTimes = [
      '2024-01-01T10:00:00.000Z',
      '2024-01-08T10:00:00.000Z',
      '2024-01-15T10:00:00.000Z',
    ];
    repoMocks.createEvent.mock.calls.forEach((call, index) => {
      const startAt = call[3];
      expect(startAt).toBe(expectedStartTimes[index]);
    });
  });

  it('creates monthly series for nth weekday rules', async () => {
    const events = [
      {
        id: 'evt-monthly',
        name: 'Monthly Planning',
        description: '```working-group-id=WG```',
        scheduled_start_time: '2024-01-02T10:00:00.000Z',
        scheduled_end_time: '2024-01-02T11:00:00.000Z',
        entity_type: DiscordEntityType.EXTERNAL,
        entity_metadata: { location: 'HQ' },
        recurrence_rule: {
          start: '2024-01-02T10:00:00.000Z',
          end: '2024-03-05T10:00:00.000Z',
          frequency: DiscordRecurrenceFrequency.MONTHLY,
          interval: 1,
          by_n_weekday: [{ n: 1, day: 1 }],
        },
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => events,
      })
    );
    const { syncDiscordEvents, repoMocks, groupMocks } = await setupDiscordService();
    groupMocks.findWorkingGroupByName.mockReturnValue({ id: 9, name: 'WG' });
    repoMocks.findEventByDiscordEventId.mockReturnValue({ id: 12, series_uuid: null });
    repoMocks.createEvent.mockReturnValue({ id: 1 } as EventRow);

    const result = await syncDiscordEvents();

    expect(result.count).toBeGreaterThan(0);
    expect(repoMocks.deleteEventById).toHaveBeenCalledWith(12);
    expect(repoMocks.createEvent).toHaveBeenCalled();
  });

  it('creates monthly series for month-day rules', async () => {
    const events = [
      {
        id: 'evt-monthday',
        name: 'Monthly Billing',
        description: '```working-group-id=WG```',
        scheduled_start_time: '2024-01-15T10:00:00.000Z',
        scheduled_end_time: '2024-01-15T11:00:00.000Z',
        entity_type: DiscordEntityType.EXTERNAL,
        entity_metadata: { location: 'HQ' },
        recurrence_rule: {
          start: '2024-01-15T10:00:00.000Z',
          end: '2024-03-15T10:00:00.000Z',
          frequency: DiscordRecurrenceFrequency.MONTHLY,
          interval: 1,
          by_month_day: [15],
        },
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => events,
      })
    );
    const { syncDiscordEvents, repoMocks, groupMocks } = await setupDiscordService();
    groupMocks.findWorkingGroupByName.mockReturnValue({ id: 9, name: 'WG' });
    repoMocks.createEvent.mockReturnValue({ id: 1 } as EventRow);

    const result = await syncDiscordEvents();

    expect(result.count).toBeGreaterThan(0);
    expect(repoMocks.createEvent).toHaveBeenCalled();
  });

  it('returns zero occurrences when monthly rules produce no dates', async () => {
    const events = [
      {
        id: 'evt-empty',
        name: 'Invalid Monthly',
        description: '```working-group-id=WG```',
        scheduled_start_time: '2024-01-01T10:00:00.000Z',
        scheduled_end_time: '2024-01-01T11:00:00.000Z',
        entity_type: DiscordEntityType.EXTERNAL,
        entity_metadata: { location: 'HQ' },
        recurrence_rule: {
          start: '2024-01-01T10:00:00.000Z',
          end: '2024-01-31T10:00:00.000Z',
          frequency: DiscordRecurrenceFrequency.MONTHLY,
          interval: 1,
          by_n_weekday: [{ n: 6, day: 1 }],
        },
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => events,
      })
    );
    const { syncDiscordEvents, repoMocks, groupMocks } = await setupDiscordService();
    groupMocks.findWorkingGroupByName.mockReturnValue({ id: 9, name: 'WG' });

    const result = await syncDiscordEvents();

    expect(result).toEqual({ count: 0, skipped: 0 });
    expect(repoMocks.createEvent).not.toHaveBeenCalled();
  });

  it('creates Discord events from app data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'discord-1' }),
      })
    );
    const { createDiscordEventFromApp, groupMocks } = await setupDiscordService();
    groupMocks.findWorkingGroupById.mockReturnValue({ id: 9, name: 'WG' });
    const event: EventRow = {
      id: 1,
      name: 'Board Meeting',
      description: 'Discuss plans',
      working_group_id: 9,
      start_at: '2024-01-01T10:00:00.000Z',
      end_at: '2024-01-01T11:00:00.000Z',
      location: 'HQ',
      location_display_name: 'HQ',
      discord_event_id: null,
      series_uuid: null,
      recurrence_rule: null,
      series_end_at: null,
      created_at: '2024-01-01T00:00:00.000Z',
    };

    const result = await createDiscordEventFromApp(event);

    expect(result).toBe('discord-1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/guilds/guild/scheduled-events'),
      expect.objectContaining({ method: 'POST' })
    );
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const payload = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(payload).toEqual({
      name: 'Board Meeting',
      description: 'Discuss plans\n\n```working-group-id=WG```',
      scheduled_start_time: '2024-01-01T10:00:00.000Z',
      scheduled_end_time: '2024-01-01T11:00:00.000Z',
      privacy_level: 2,
      entity_type: 3,
      entity_metadata: {
        location: 'HQ',
      },
    });
  });

  it('throws when Discord update fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'bad request',
      })
    );
    const { updateDiscordEventFromApp } = await setupDiscordService();
    const event = {
      id: 1,
      name: 'Board Meeting',
      description: 'Discuss plans',
      working_group_id: 9,
      start_at: '2024-01-01T10:00:00.000Z',
      end_at: '2024-01-01T11:00:00.000Z',
      location: 'HQ',
      location_display_name: 'HQ',
      discord_event_id: null,
      series_uuid: null,
      recurrence_rule: null,
      series_end_at: null,
      created_at: '2024-01-01T00:00:00.000Z',
    } as EventRow;

    await expect(updateDiscordEventFromApp('discord-1', event)).rejects.toThrow('Discord API error 400');
  });

  it('updates Discord events when the API responds ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })
    );
    const { updateDiscordEventFromApp } = await setupDiscordService();
    const event = {
      id: 1,
      name: 'Board Meeting',
      description: 'Discuss plans',
      working_group_id: 9,
      start_at: '2024-01-01T10:00:00.000Z',
      end_at: '2024-01-01T11:00:00.000Z',
      location: 'HQ',
      location_display_name: 'HQ',
      discord_event_id: null,
      series_uuid: null,
      recurrence_rule: null,
      series_end_at: null,
      created_at: '2024-01-01T00:00:00.000Z',
    } as EventRow;

    await updateDiscordEventFromApp('discord-1', event);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/scheduled-events/discord-1'),
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('throws when Discord create fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'server error',
      })
    );
    const { createDiscordEventFromApp } = await setupDiscordService();
    const event = {
      id: 1,
      name: 'Board Meeting',
      description: 'Discuss plans',
      working_group_id: 9,
      start_at: '2024-01-01T10:00:00.000Z',
      end_at: '2024-01-01T11:00:00.000Z',
      location: 'HQ',
      location_display_name: 'HQ',
      discord_event_id: null,
      series_uuid: null,
      recurrence_rule: null,
      series_end_at: null,
      created_at: '2024-01-01T00:00:00.000Z',
    } as EventRow;

    await expect(createDiscordEventFromApp(event)).rejects.toThrow('Discord API error 500');
  });

  it('includes recurrence rules in payload when stored', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'discord-2' }),
      })
    );
    const { createDiscordEventFromApp } = await setupDiscordService();
    const event = {
      id: 2,
      name: 'Recurring Event',
      description: 'Recurring',
      working_group_id: 0,
      start_at: '2024-01-01T10:00:00.000Z',
      end_at: '2024-01-01T11:00:00.000Z',
      location: 'HQ',
      location_display_name: null,
      discord_event_id: null,
      series_uuid: null,
      recurrence_rule: JSON.stringify({
        start: '2024-01-01T10:00:00.000Z',
        frequency: DiscordRecurrenceFrequency.DAILY,
        interval: 1,
      }),
      series_end_at: null,
      created_at: '2024-01-01T00:00:00.000Z',
    } as EventRow;

    await createDiscordEventFromApp(event);

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const payload = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(payload.recurrence_rule).toEqual({
      start: '2024-01-01T10:00:00.000Z',
      frequency: DiscordRecurrenceFrequency.DAILY,
      interval: 1,
    });
  });

  it('omits invalid stored recurrence rules from payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'discord-3' }),
      })
    );
    const { createDiscordEventFromApp } = await setupDiscordService();
    const event = {
      id: 3,
      name: 'Bad Recurrence',
      description: 'Bad rule',
      working_group_id: 0,
      start_at: '2024-01-01T10:00:00.000Z',
      end_at: '2024-01-01T11:00:00.000Z',
      location: 'HQ',
      location_display_name: null,
      discord_event_id: null,
      series_uuid: null,
      recurrence_rule: 'not-json',
      series_end_at: null,
      created_at: '2024-01-01T00:00:00.000Z',
    } as EventRow;

    await createDiscordEventFromApp(event);

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const payload = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(payload).not.toHaveProperty('recurrence_rule');
  });

  it('throws when Discord event fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'unauthorized',
      })
    );
    const { syncDiscordEvents } = await setupDiscordService();

    await expect(syncDiscordEvents()).rejects.toThrow('Discord API error 401');
  });
});
