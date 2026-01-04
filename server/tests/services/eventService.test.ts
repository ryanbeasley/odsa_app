import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscordRecurrenceFrequency } from '../../src/services/discordTypes';
import type { EventPayload, EventRow } from '../../src/types';

vi.mock('../../src/repositories/eventRepository', () => ({
  createEvent: vi.fn(),
  deleteEventById: vi.fn(),
  deleteEventsBySeries: vi.fn(),
  updateEvent: vi.fn(),
  updateEventDiscordId: vi.fn(),
}));

vi.mock('../../src/services/discordService', () => ({
  createDiscordEventFromApp: vi.fn(async () => 'discord-123'),
  updateDiscordEventFromApp: vi.fn(async () => {}),
}));

import {
  expandRecurringEvents,
  normalizeDisplayName,
  normalizeRecurrenceRuleInput,
  syncDiscordEvent,
  updateRecurringSeries,
  updateSingleEvent,
  validateEvent,
  validateEventPayload,
} from '../../src/services/eventService';
import {
  createEvent,
  deleteEventById,
  deleteEventsBySeries,
  updateEvent,
  updateEventDiscordId,
} from '../../src/repositories/eventRepository';
import { createDiscordEventFromApp, updateDiscordEventFromApp } from '../../src/services/discordService';

describe('eventService', () => {
  beforeEach(() => {
    console.logEnter = (() => {}) as typeof console.logEnter;
    vi.clearAllMocks();
  });

  it('validates event payloads', () => {
    expect(validateEvent({})).toBe('name is required');
    expect(
      validateEvent({
        name: 'Event',
        description: 'Desc',
        workingGroupId: 1,
        startAt: '2024-01-01T11:00:00.000Z',
        endAt: '2024-01-01T10:00:00.000Z',
        location: 'HQ',
      })
    ).toBe('endAt must be after startAt');
  });

  it('normalizes display names', () => {
    expect(normalizeDisplayName(null)).toBeNull();
    expect(normalizeDisplayName('   ')).toBeNull();
    expect(normalizeDisplayName(' Room A ')).toBe('Room A');
  });

  it('normalizes recurrence rules', () => {
    const start = new Date('2024-01-01T10:00:00.000Z');
    const weekly = normalizeRecurrenceRuleInput({ frequency: DiscordRecurrenceFrequency.WEEKLY }, start);
    if ('error' in weekly) {
      throw new Error('Unexpected error');
    }
    expect(weekly.recurrence).toBe('weekly');
    expect(weekly.rule?.by_weekday).toEqual([0]);

    const invalid = normalizeRecurrenceRuleInput({ frequency: 99 }, start);
    expect('error' in invalid).toBe(true);
  });

  it('expands recurring events with weekday filtering', () => {
    const events = expandRecurringEvents({
      baseEvent: {
        name: 'Daily',
        description: 'Daily',
        workingGroupId: 1,
        startAt: new Date('2024-01-01T10:00:00.000Z'),
        endAt: new Date('2024-01-01T11:00:00.000Z'),
        location: 'HQ',
        locationDisplayName: null,
      },
      recurrence: 'daily',
      seriesEnd: new Date('2024-01-03T10:00:00.000Z'),
      seriesUuid: 'series-1',
      monthlyPattern: 'date',
      dailyWeekdays: [0],
      recurrenceRuleJson: null,
    });
    expect(events).toHaveLength(1);
  });

  it('validates and normalizes event payload input', () => {
    const payload: EventPayload = {
      name: '  Event ',
      description: '  Desc ',
      workingGroupId: 3,
      startAt: '2024-01-01T10:00:00.000Z',
      endAt: '2024-01-01T11:00:00.000Z',
      location: ' HQ ',
      locationDisplayName: ' ',
      recurrenceRule: {
        frequency: DiscordRecurrenceFrequency.DAILY,
      },
      seriesEndAt: ' 2024-01-03T10:00:00.000Z ',
    };

    const result = validateEventPayload(payload);
    if ('error' in result) {
      throw new Error('Unexpected error');
    }
    expect(result.payload.name).toBe('Event');
    expect(result.payload.description).toBe('Desc');
    expect(result.payload.location).toBe('HQ');
    expect(result.payload.locationDisplayName).toBeNull();
    expect(result.payload.seriesEndAt).toBe('2024-01-03T10:00:00.000Z');
    expect(result.normalized.recurrence).toBe('daily');
  });

  it('creates recurring series events and deletes existing series', async () => {
    const payload: EventPayload = {
      name: 'Event',
      description: 'Desc',
      workingGroupId: 1,
      startAt: '2024-01-01T10:00:00.000Z',
      endAt: '2024-01-01T11:00:00.000Z',
      location: 'HQ',
      recurrenceRule: {
        frequency: DiscordRecurrenceFrequency.DAILY,
        interval: 1,
      },
      seriesEndAt: '2024-01-03T10:00:00.000Z',
    };

    const normalized = normalizeRecurrenceRuleInput(payload.recurrenceRule, new Date(payload.startAt));
    if ('error' in normalized) {
      throw new Error('Unexpected error');
    }

    let counter = 0;
    vi.mocked(createEvent).mockImplementation(() => ({ id: ++counter } as never));

    const result = await updateRecurringSeries({
      id: 10,
      existing: { id: 99, series_uuid: 'series-old' } as never,
      payload,
      normalized,
      seriesEndDate: new Date('2024-01-03T10:00:00.000Z'),
      recurrenceRuleJson: JSON.stringify(normalized.rule),
    });

    expect(deleteEventsBySeries).toHaveBeenCalledWith('series-old');
    expect(deleteEventById).not.toHaveBeenCalled();
    expect(createEvent).toHaveBeenCalledTimes(3);
    expect(result?.id).toBe(1);
  });

  it('updates single events and clears existing series', async () => {
    vi.mocked(updateEvent).mockReturnValue({ id: 12 } as never);
    const payload: EventPayload = {
      name: 'Event',
      description: 'Desc',
      workingGroupId: 1,
      startAt: '2024-01-01T10:00:00.000Z',
      endAt: '2024-01-01T11:00:00.000Z',
      location: 'HQ',
    };
    const result = await updateSingleEvent({
      id: 12,
      existing: { id: 12, series_uuid: 'series-old' } as never,
      payload,
      recurrenceRuleJson: null,
    });

    expect(deleteEventsBySeries).toHaveBeenCalledWith('series-old');
    expect(updateEvent).toHaveBeenCalled();
    expect(result?.id).toBe(12);
  });

  it('syncs discord events when a discord id exists', async () => {
    const event = { id: 1, discord_event_id: 'discord-1' } as never;
    await syncDiscordEvent(event);
    expect(updateDiscordEventFromApp).toHaveBeenCalledWith('discord-1', event);
    expect(createDiscordEventFromApp).not.toHaveBeenCalled();
  });

  it('creates discord events when missing a discord id', async () => {
    const event = { id: 2, discord_event_id: null } as EventRow;
    await syncDiscordEvent(event);
    expect(createDiscordEventFromApp).toHaveBeenCalledWith(event);
    expect(updateEventDiscordId).toHaveBeenCalledWith(2, 'discord-123');
    expect(event.discord_event_id).toBe('discord-123');
  });
});
