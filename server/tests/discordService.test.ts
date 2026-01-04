import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventRow } from '../src/types';
import { DiscordEntityType, DiscordRecurrenceFrequency } from '../src/services/discordTypes';

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
  syncDiscordEvents: typeof import('../src/services/discordService').syncDiscordEvents;
  createDiscordEventFromApp: typeof import('../src/services/discordService').createDiscordEventFromApp;
  updateDiscordEventFromApp: typeof import('../src/services/discordService').updateDiscordEventFromApp;
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
  vi.doMock('../src/config/env', () => ({
    DISCORD_BOT_TOKEN: overrides?.token ?? 'token',
    DISCORD_GUILD_ID: overrides?.guildId ?? 'guild',
  }));
  vi.doMock('../src/repositories/eventRepository', () => repoMocks);
  vi.doMock('../src/repositories/workingGroupRepository', () => groupMocks);

  const module = await import('../src/services/discordService');
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
});
