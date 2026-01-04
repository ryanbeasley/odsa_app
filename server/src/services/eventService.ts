import crypto from 'node:crypto';
import {
  createEvent,
  deleteEventById,
  deleteEventsBySeries,
  updateEvent,
  updateEventDiscordId,
} from '../repositories/eventRepository';
import { createDiscordEventFromApp, updateDiscordEventFromApp } from './discordService';
import { DiscordRecurrenceFrequency, DiscordWeekday } from './discordTypes';
import { MonthlyPattern, NormalizedRecurrence, RecurrenceRule, EventPayload } from '../types';

type DiscordRecurrenceRule = {
  start: string;
  frequency: number;
  interval?: number | null;
  by_weekday?: number[] | null;
  by_n_weekday?: Array<{ n: number; day: number }> | null;
  by_month_day?: number[] | null;
};

type DiscordRecurrenceRuleInput = EventPayload['recurrenceRule'];

/**
 * Validates and normalizes an event payload from request body.
 */
export function validateEventPayload(body: unknown) {
  const error = validateEvent(body);
  if (error) {
    return { error };
  }
  const payload = body as EventPayload;
  const numericWorkingGroupId = Number(payload.workingGroupId);
  const normalizedPayload: EventPayload = {
    ...payload,
    workingGroupId: numericWorkingGroupId,
    name: payload.name.trim(),
    description: payload.description.trim(),
    location: payload.location.trim(),
    locationDisplayName: normalizeDisplayName(payload.locationDisplayName),
    startAt: payload.startAt.trim(),
    endAt: payload.endAt.trim(),
    seriesEndAt: payload.seriesEndAt?.trim() ?? null,
  };
  const baseStart = new Date(normalizedPayload.startAt);
  const normalized = normalizeRecurrenceRuleInput(normalizedPayload.recurrenceRule, baseStart);
  if ('error' in normalized) {
    console.log('Recurrence rule normalization error:', normalized.error);
    return { error: normalized.error };
  }
  return {
    payload: normalizedPayload,
    normalized,
  } as {
    payload: EventPayload;
    normalized: NormalizedRecurrence;
  };
}

/**
 * Updates a recurring series of events based on the provided parameters.
 */
export async function updateRecurringSeries(params: {
  id: number;
  existing: ReturnType<typeof updateEvent>;
  payload: EventPayload;
  normalized: NormalizedRecurrence;
  seriesEndDate: Date | null;
  recurrenceRuleJson: string | null;
}) {
  const { id, existing, payload, normalized, seriesEndDate, recurrenceRuleJson } = params;
  const seriesUuid = existing?.series_uuid ?? crypto.randomUUID();
  if (existing?.series_uuid) {
    console.log('Deleting existing series:', existing.series_uuid);
    deleteEventsBySeries(existing.series_uuid);
  } else {
    console.log('Deleting single event ID for regeneration:', id);
    deleteEventById(id);
  }

  const baseStart = new Date(payload.startAt);
  const baseEnd = new Date(payload.endAt);
  const expanded = expandRecurringEvents({
    baseEvent: {
      name: payload.name,
      description: payload.description,
      workingGroupId: payload.workingGroupId,
      startAt: baseStart,
      endAt: baseEnd,
      location: payload.location,
      locationDisplayName: payload.locationDisplayName ?? null,
    },
    recurrence: normalized.recurrence,
    seriesEnd: seriesEndDate,
    seriesUuid,
    monthlyPattern: normalized.monthlyPattern,
    dailyWeekdays: normalized.dailyWeekdays,
    recurrenceRuleJson,
  });

  const createdEvents = expanded.map((eventPayload) =>
    createEvent(
      eventPayload.name,
      eventPayload.description,
      eventPayload.workingGroupId,
      eventPayload.startAt,
      eventPayload.endAt,
      eventPayload.location,
      eventPayload.locationDisplayName,
      eventPayload.seriesUuid,
      eventPayload.recurrenceRuleJson ?? null,
      eventPayload.seriesEndAt
    )
  );

  return createdEvents[0];
}

/**
 * Updates a single (non-recurring) event.
 */
export async function updateSingleEvent(params: {
  id: number;
  existing: ReturnType<typeof updateEvent>;
  payload: EventPayload;
  recurrenceRuleJson: string | null;
}) {
  const { id, existing, payload, recurrenceRuleJson } = params;
  if (existing?.series_uuid) {
    deleteEventsBySeries(existing.series_uuid);
  }
  return updateEvent(
    id,
    payload.name,
    payload.description,
    payload.workingGroupId,
    new Date(payload.startAt).toISOString(),
    new Date(payload.endAt).toISOString(),
    payload.location,
    payload.locationDisplayName ?? null,
    recurrenceRuleJson
  );
}

/**
 * Syncs a single event to Discord, creating or updating as necessary.
 */
export async function syncDiscordEvent(event: NonNullable<ReturnType<typeof updateEvent>>) {
  if (event.discord_event_id) {
    await updateDiscordEventFromApp(event.discord_event_id, event);
    return;
  }
  const discordEventId = await createDiscordEventFromApp(event);
  updateEventDiscordId(event.id, discordEventId);
  event.discord_event_id = discordEventId;
}

/**
 * Validates the body of an event payload.
 */
export function validateEvent(body: unknown) {
  console.logEnter();
  const { name, description, workingGroupId, startAt, endAt, location, locationDisplayName, createDiscordEvent, recurrenceRule } =
    (body ?? {}) as Record<string, unknown>;
  if (typeof name !== 'string' || !name.trim()) {
    return 'name is required';
  }
  if (typeof description !== 'string' || !description.trim()) {
    return 'description is required';
  }
  if (!Number.isFinite(Number(workingGroupId)) || Number(workingGroupId) <= 0) {
    return 'workingGroupId must be a positive number';
  }
  if (typeof startAt !== 'string' || !startAt.trim() || Number.isNaN(new Date(startAt).getTime())) {
    return 'startAt must be a valid ISO date';
  }
  if (typeof endAt !== 'string' || !endAt.trim() || Number.isNaN(new Date(endAt).getTime())) {
    return 'endAt must be a valid ISO date';
  }
  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    return 'endAt must be after startAt';
  }
  if (typeof location !== 'string' || !location.trim()) {
    return 'location is required';
  }
  if (locationDisplayName !== undefined && locationDisplayName !== null && typeof locationDisplayName !== 'string') {
    return 'locationDisplayName must be a string';
  }
  if (createDiscordEvent !== undefined && typeof createDiscordEvent !== 'boolean') {
    return 'createDiscordEvent must be a boolean';
  }
  if (recurrenceRule !== undefined && recurrenceRule !== null && typeof recurrenceRule !== 'object') {
    return 'recurrenceRule must be an object';
  }
  return null;
}

/**
 * Normalizes a display name string, returning null if empty or invalid.
 */
export function normalizeDisplayName(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Expands a recurring event into its individual occurrences.
 */
export function expandRecurringEvents(params: {
  baseEvent: {
    name: string;
    description: string;
    workingGroupId: number;
    startAt: Date;
    endAt: Date;
    location: string;
    locationDisplayName: string | null;
  };
  recurrence: RecurrenceRule;
  seriesEnd: Date | null;
  seriesUuid: string | null;
  monthlyPattern?: MonthlyPattern;
  dailyWeekdays?: number[] | null;
  recurrenceRuleJson?: string | null;
}) {
  console.logEnter();
  const { baseEvent, recurrence, seriesEnd, seriesUuid, monthlyPattern = 'date', dailyWeekdays, recurrenceRuleJson } = params;
  const events = [];
  const startIso = baseEvent.startAt.toISOString();
  const endIso = baseEvent.endAt.toISOString();
  events.push({
    name: baseEvent.name,
    description: baseEvent.description,
    workingGroupId: baseEvent.workingGroupId,
    startAt: startIso,
    endAt: endIso,
    location: baseEvent.location,
    locationDisplayName: baseEvent.locationDisplayName,
    seriesUuid,
    recurrenceRuleJson: recurrenceRuleJson ?? null,
    seriesEndAt: seriesEnd ? seriesEnd.toISOString() : null,
  });

  if (recurrence === 'none' || !seriesEnd) {
    return events;
  }

  console.log('Expanding recurring events with rule:', recurrence, monthlyPattern, seriesEnd.toISOString());
  const durationMs = baseEvent.endAt.getTime() - baseEvent.startAt.getTime();
  const weekIndex = Math.ceil(baseEvent.startAt.getDate() / 7);
  const weekday = baseEvent.startAt.getDay();

  let cursorStart = new Date(baseEvent.startAt);
  while (true) {
    const nextStart = getNextOccurrenceStart(cursorStart, recurrence, monthlyPattern, weekIndex, weekday, baseEvent.startAt);
    if (!nextStart) {
      break;
    }
    if (nextStart.getTime() > seriesEnd.getTime()) {
      break;
    }
    if (recurrence === 'daily' && dailyWeekdays?.length) {
      const nextWeekday = mapDiscordWeekday(nextStart);
      if (!dailyWeekdays.includes(nextWeekday)) {
        cursorStart = nextStart;
        continue;
      }
    }
    const nextEnd = new Date(nextStart.getTime() + durationMs);
    const thisEvent = {
      name: baseEvent.name,
      description: baseEvent.description,
      workingGroupId: baseEvent.workingGroupId,
      startAt: nextStart.toISOString(),
      endAt: nextEnd.toISOString(),
      location: baseEvent.location,
      locationDisplayName: baseEvent.locationDisplayName,
      seriesUuid,
      recurrenceRuleJson: recurrenceRuleJson ?? null,
      seriesEndAt: seriesEnd ? seriesEnd.toISOString() : null,
    };
    events.push(thisEvent);
    cursorStart = nextStart;
    console.debug('Created new event series occurence:', thisEvent);
  }
  console.log(`Expanded to total of ${events.length} events in series.`);
  return events;
}

/**
 * Validates and normalizes a recurrence rule input.
 */
export function normalizeRecurrenceRuleInput(
  recurrenceRule: DiscordRecurrenceRuleInput | null | undefined,
  start: Date
) {
  console.logEnter();
  if (!recurrenceRule) {
    return { recurrence: 'none' as RecurrenceRule, monthlyPattern: 'date' as MonthlyPattern, rule: null, dailyWeekdays: null };
  }
  if (typeof recurrenceRule.frequency !== 'number') {
    return { error: 'recurrenceRule.frequency must be a number' } as const;
  }
  if (![DiscordRecurrenceFrequency.MONTHLY, DiscordRecurrenceFrequency.WEEKLY, DiscordRecurrenceFrequency.DAILY].includes(recurrenceRule.frequency)) {
    return { error: 'recurrenceRule.frequency must be DAILY (3), WEEKLY (2), or MONTHLY (1)' } as const;
  }
  const rule: DiscordRecurrenceRule = {
    start: start.toISOString(),
    frequency: recurrenceRule.frequency,
    interval: recurrenceRule.interval ?? 1,
  };

  if (recurrenceRule.frequency === DiscordRecurrenceFrequency.DAILY) {
    const weekdays = recurrenceRule.by_weekday?.length ? recurrenceRule.by_weekday.slice() : null;
    if (weekdays) {
      rule.by_weekday = weekdays;
    }
    return { recurrence: 'daily' as RecurrenceRule, monthlyPattern: 'date' as MonthlyPattern, rule, dailyWeekdays: weekdays };
  }

  if (recurrenceRule.frequency === DiscordRecurrenceFrequency.WEEKLY) {
    const weekday = recurrenceRule.by_weekday?.[0] ?? mapDiscordWeekday(start);
    rule.by_weekday = [weekday];
    return { recurrence: 'weekly' as RecurrenceRule, monthlyPattern: 'date' as MonthlyPattern, rule, dailyWeekdays: null };
  }

  const nWeekday = recurrenceRule.by_n_weekday?.[0] ?? null;
  if (nWeekday) {
    rule.by_n_weekday = [nWeekday];
    return { recurrence: 'monthly' as RecurrenceRule, monthlyPattern: 'weekday' as MonthlyPattern, rule, dailyWeekdays: null };
  }
  const monthDay = recurrenceRule.by_month_day?.[0] ?? start.getUTCDate();
  rule.by_month_day = [monthDay];
  return { recurrence: 'monthly' as RecurrenceRule, monthlyPattern: 'date' as MonthlyPattern, rule, dailyWeekdays: null };
}

/**
 * Maps a JavaScript Date's day to Discord's weekday representation.
 */
export function mapDiscordWeekday(date: Date) {
  const day = date.getUTCDay();
  if (day === 0) {
    return DiscordWeekday.SUNDAY;
  }
  return day - 1;
}

/**
 * Calculates the next occurrence start date based on the recurrence rule.
 */
export function getNextOccurrenceStart(
  currentStart: Date,
  recurrence: RecurrenceRule,
  monthlyPattern: MonthlyPattern,
  weekIndex: number,
  weekday: number,
  referenceStart: Date
) {
  const next = new Date(currentStart);
  switch (recurrence) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      return next;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      return next;
    case 'monthly':
      if (monthlyPattern === 'weekday') {
        return getNextMonthlyWeekday(next, weekIndex, weekday, referenceStart);
      }
      next.setMonth(next.getMonth() + 1);
      return next;
    default:
      return null;
  }
}

/**
 * Calculates the next monthly occurrence based on the nth weekday pattern.
 */
export function getNextMonthlyWeekday(
  current: Date,
  weekIndex: number,
  weekday: number,
  referenceStart: Date
) {
  const candidate = new Date(current);
  candidate.setMonth(candidate.getMonth() + 1);
  const year = candidate.getFullYear();
  const month = candidate.getMonth();
  return getNthWeekdayOfMonth(year, month, weekIndex, weekday, referenceStart);
}

/**
 * Gets the date of the nth weekday of a given month and year.
 */
export function getNthWeekdayOfMonth(
  year: number,
  month: number,
  nth: number,
  weekday: number,
  referenceStart: Date
) {
  const firstOfMonth = new Date(referenceStart);
  firstOfMonth.setFullYear(year, month, 1);
  firstOfMonth.setHours(referenceStart.getHours(), referenceStart.getMinutes(), referenceStart.getSeconds(), referenceStart.getMilliseconds());
  const offset = (weekday - firstOfMonth.getDay() + 7) % 7;
  const date = 1 + offset + (nth - 1) * 7;
  const result = new Date(firstOfMonth);
  result.setDate(date);
  if (result.getMonth() !== month) {
    result.setDate(result.getDate() - 7);
  }
  return result;
}
