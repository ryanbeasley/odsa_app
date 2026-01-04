import { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID } from '../config/env';
import { randomUUID } from 'crypto';
import { EventRow } from '../types';
import {
  createEvent,
  deleteEventById,
  deleteEventsBySeries,
  findEventByDiscordEventId,
  upsertDiscordEvent,
  updateEventDiscordId,
} from '../repositories/eventRepository';
import { findWorkingGroupById, findWorkingGroupByName } from '../repositories/workingGroupRepository';
import {
  DiscordEntityType,
  DiscordPrivacyLevel,
  DiscordRecurrenceFrequency,
  DiscordWeekday,
} from './discordTypes';

type DiscordScheduledEvent = {
  id: string;
  name: string;
  description?: string | null;
  scheduled_start_time: string;
  scheduled_end_time?: string | null;
  entity_type: number;
  entity_metadata?: { location?: string | null } | null;
  channel_id?: string | null;
  status?: number;
  recurrence_rule?: DiscordRecurrenceRule | null;
};

type DiscordRecurrenceRule = {
  start: string;
  end?: string | null;
  frequency: number;
  interval?: number | null;
  by_weekday?: number[] | null;
  by_n_weekday?: Array<{ n: number; day: number }> | null;
  by_month?: number[] | null;
  by_month_day?: number[] | null;
};

const DISCORD_API = 'https://discord.com/api/v10';
const DEFAULT_DURATION_MS = 60 * 60 * 1000;

export async function syncDiscordEvents() {
  console.logEnter();
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
    throw new Error('Discord is not configured on the server.');
  }
  console.log('Starting sync for guild', DISCORD_GUILD_ID);
  const events = await fetchDiscordEvents();
  console.log('Fetched', events.length, 'scheduled events');
  const totals = events.reduce(
    (acc, event) => {
      const outcome = processDiscordEvent(event);
      acc.createdOrUpdated += outcome.created;
      acc.skipped += outcome.skipped;
      return acc;
    },
    { createdOrUpdated: 0, skipped: 0 }
  );

  const { createdOrUpdated, skipped } = totals;
  console.log('Sync complete', { createdOrUpdated, skipped });
  return { count: createdOrUpdated, skipped };
}

export async function createDiscordEventFromApp(event: EventRow) {
  console.logEnter();
  ensureDiscordConfigured();
  const payload = buildDiscordEventPayload(event);
  const response = await fetch(`${DISCORD_API}/guilds/${DISCORD_GUILD_ID}/scheduled-events`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord API error ${response.status}: ${body}`);
  }
  const data = (await response.json()) as { id: string };
  return data.id;
}

export async function updateDiscordEventFromApp(discordEventId: string, event: EventRow) {
  console.logEnter();
  ensureDiscordConfigured();
  const payload = buildDiscordEventPayload(event);
  const response = await fetch(`${DISCORD_API}/guilds/${DISCORD_GUILD_ID}/scheduled-events/${discordEventId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord API error ${response.status}: ${body}`);
  }
}

async function fetchDiscordEvents(): Promise<DiscordScheduledEvent[]> {
  const response = await fetch(`${DISCORD_API}/guilds/${DISCORD_GUILD_ID}/scheduled-events?with_user_count=true`, {
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord API error ${response.status}: ${body}`);
  }
  return (await response.json()) as DiscordScheduledEvent[];
}

function processDiscordEvent(event: DiscordScheduledEvent) {
  logEventSummary(event);

  const startAt = getValidStart(event);
  if (!startAt) {
    return { created: 0, skipped: 1 };
  }

  const parsedDescription = parseDescription(event.description);
  const workingGroupId = resolveWorkingGroupId(parsedDescription.workingGroupName);
  if (!workingGroupId) {
    console.log('Skipping event without matching working group', event.id, parsedDescription.workingGroupName ?? '');
    return { created: 0, skipped: 1 };
  }

  if (event.recurrence_rule && !isSupportedRecurrenceRule(event.recurrence_rule)) {
    console.warn('Skipping event with unsupported recurrence rule', {
      id: event.id,
      name: event.name,
      recurrenceRule: event.recurrence_rule,
    });
    return { created: 0, skipped: 1 };
  }

  const endAt = buildEndAt(event, startAt);
  const locationDetails = buildLocationDetails(event);
  const recurrenceType = event.recurrence_rule ? mapDiscordRecurrence(event.recurrence_rule) : null;

  if (event.recurrence_rule && recurrenceType) {
    const created = upsertDiscordSeriesEvent({
      event,
      workingGroupId,
      description: parsedDescription.cleaned || 'Discord event',
      location: locationDetails.link,
      locationDisplayName: locationDetails.displayName,
    });
    return { created, skipped: 0 };
  }

  const thisEvent = buildSingleEventPayload(event, {
    workingGroupId,
    startAt,
    endAt,
    description: parsedDescription.cleaned,
    locationDetails,
  });
  upsertDiscordEvent(thisEvent);
  console.debug('Upserted single event from Discord:', thisEvent);
  return { created: 1, skipped: 0 };
}

function logEventSummary(event: DiscordScheduledEvent) {
  console.log('Processing event', {
    id: event.id,
    name: event.name,
    description: event.description ?? null,
    start: event.scheduled_start_time,
    end: event.scheduled_end_time ?? null,
    entityType: event.entity_type,
    location: event.entity_metadata?.location ?? null,
    channelId: event.channel_id ?? null,
  });
}

function getValidStart(event: DiscordScheduledEvent) {
  if (!event.scheduled_start_time) {
    console.log('Skipping event without start time', event.id);
    return null;
  }
  const startAt = new Date(event.scheduled_start_time);
  if (Number.isNaN(startAt.getTime())) {
    console.log('Skipping event with invalid start time', event.id);
    return null;
  }
  return startAt;
}

function buildEndAt(event: DiscordScheduledEvent, startAt: Date) {
  return event.scheduled_end_time ? new Date(event.scheduled_end_time) : new Date(startAt.getTime() + DEFAULT_DURATION_MS);
}

function buildSingleEventPayload(
  event: DiscordScheduledEvent,
  params: {
    workingGroupId: number;
    startAt: Date;
    endAt: Date;
    description: string;
    locationDetails: { link: string; displayName: string | null };
  }
) {
  const { workingGroupId, startAt, endAt, description, locationDetails } = params;
  return {
    discordEventId: event.id,
    name: event.name.trim(),
    description: description || 'Discord event',
    workingGroupId,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    location: locationDetails.link,
    locationDisplayName: locationDetails.displayName,
    recurrenceRule: event.recurrence_rule ? JSON.stringify(event.recurrence_rule) : null,
  };
}

/**
 * Creates location url links and display names based on Discord event entity type.
 */
function buildLocationDetails(event: DiscordScheduledEvent) {
  if (event.entity_type === DiscordEntityType.EXTERNAL) {
    const rawLocation = event.entity_metadata?.location?.trim() ?? 'Discord event';
    if (isHttpLink(rawLocation)) {
      return { link: rawLocation, displayName: null };
    }
    return {
      link: `https://maps.google.com/?q=${encodeURIComponent(rawLocation)}`,
      displayName: rawLocation,
    };
  }
  const channelId = event.channel_id;
  const link = channelId ? `https://discord.com/channels/${DISCORD_GUILD_ID}/${channelId}` : `https://discord.com/channels/${DISCORD_GUILD_ID}`;
  const displayName = event.entity_type === DiscordEntityType.STAGE_INSTANCE ? 'Discord stage' : 'Discord voice';
  return { link, displayName };
}

/**
 * builds a discord event payload from an internal event record.
 */
function buildDiscordEventPayload(event: EventRow) {
  const location = (event.location_display_name ?? event.location ?? 'TBD').trim();
  const groupName = event.working_group_id ? findWorkingGroupById(event.working_group_id)?.name ?? null : null;
  const workingGroupTag = groupName ? `\n\n\`\`\`working-group-id=${groupName}\`\`\`` : '';
  const recurrenceRule = parseStoredRecurrenceRule(event.recurrence_rule);
  const payload: Record<string, unknown> = {
    name: event.name,
    description: `${event.description}${workingGroupTag}`,
    scheduled_start_time: new Date(event.start_at).toISOString(),
    scheduled_end_time: new Date(event.end_at).toISOString(),
    privacy_level: DiscordPrivacyLevel.GUILD_ONLY,
    entity_type: DiscordEntityType.EXTERNAL,
    entity_metadata: {
      location,
    },
  };
  if (recurrenceRule) {
    payload.recurrence_rule = recurrenceRule;
  }
  return payload;
}

/**
 * Ensures that Discord configuration is present.
 */
function ensureDiscordConfigured() {
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
    throw new Error('Discord is not configured on the server.');
  }
}

/**
 * Upserts a Discord series event and its occurrences into the local database.
 */
function upsertDiscordSeriesEvent(params: {
  event: DiscordScheduledEvent;
  workingGroupId: number;
  description: string;
  location: string;
  locationDisplayName: string | null;
}) {
  const { event, workingGroupId, description, location, locationDisplayName } = params;
  const occurrences = buildSeriesOccurrences(event);
  console.log('Built', occurrences.length, 'occurrences for series event', event.id);
  if (!occurrences.length) {
    return 0;
  }
  const existing = findEventByDiscordEventId(event.id);
  console.log('Existing event lookup for series', {
    discordEventId: event.id,
    existingEventId: existing?.id ?? null,
    existingSeriesUuid: existing?.series_uuid ?? null,
  });
  if (existing?.series_uuid) {
    deleteEventsBySeries(existing.series_uuid);
  } else if (existing) {
    deleteEventById(existing.id);
  }
  const seriesUuid = randomUUID();
  const seriesEndAt = occurrences.at(occurrences.length - 1)?.endAt.toISOString() ?? null;
  const recurrenceRuleJson = event.recurrence_rule ? JSON.stringify(event.recurrence_rule) : null;
  occurrences.forEach((occ, index) => {
    const created = createEvent(
      event.name.trim(),
      description,
      workingGroupId,
      occ.startAt.toISOString(),
      occ.endAt.toISOString(),
      location,
      locationDisplayName,
      seriesUuid,
      recurrenceRuleJson,
      seriesEndAt
    );
    if (index === 0) {
      updateEventDiscordId(created.id, event.id);
    }
  });
  return occurrences.length;
}

/**
 * Maps Discord recurrence rule to internal recurrence string.
 */
function mapDiscordRecurrence(rule?: DiscordRecurrenceRule | null) {
  if (!rule) {
    return null;
  }
  if (rule.frequency === DiscordRecurrenceFrequency.DAILY) {
    return 'daily';
  }
  if (rule.frequency === DiscordRecurrenceFrequency.WEEKLY) {
    return 'weekly';
  }
  if (rule.frequency === DiscordRecurrenceFrequency.MONTHLY) {
    return 'monthly';
  }
  return null;
}

/**
 * Determines if a recurrence rule is supported.
 */
function isSupportedRecurrenceRule(rule: DiscordRecurrenceRule) {
  if (!rule.frequency) {
    return false;
  }
  const interval = rule.interval ?? 1;
  if (interval !== 1) {
    return false;
  }
  if (rule.frequency === DiscordRecurrenceFrequency.DAILY) {
    return !rule.by_weekday?.length && !rule.by_month?.length && !rule.by_month_day?.length && !rule.by_n_weekday?.length;
  }
  if (rule.frequency === DiscordRecurrenceFrequency.WEEKLY) {
    if (rule.by_weekday && rule.by_weekday.length > 1) {
      return false;
    }
    return !rule.by_month?.length && !rule.by_month_day?.length && !rule.by_n_weekday?.length;
  }
  if (rule.frequency === DiscordRecurrenceFrequency.MONTHLY) {
    if (rule.by_month?.length) {
      return false;
    }
    if (rule.by_weekday?.length) {
      return false;
    }
    if (rule.by_n_weekday && rule.by_n_weekday.length > 1) {
      return false;
    }
    if (rule.by_month_day && rule.by_month_day.length > 1) {
      return false;
    }
    const hasNthWeekday = Boolean(rule.by_n_weekday?.length);
    const hasMonthDay = Boolean(rule.by_month_day?.length);
    return hasNthWeekday !== hasMonthDay;
  }
  return false;
}

/**
 * Builds all occurrences for a recurring Discord event.
 */
function buildSeriesOccurrences(event: DiscordScheduledEvent) {
  console.logEnter();
  const rule = event.recurrence_rule;
  if (!rule) {
    return [];
  }
  const recurrence = mapDiscordRecurrence(rule);
  if (!recurrence) {
    return [
      buildOccurrence(new Date(event.scheduled_start_time), new Date(event.scheduled_end_time ?? event.scheduled_start_time)),
    ].filter((occ) => !Number.isNaN(occ.startAt.getTime()));
  }

  const start = new Date(rule.start ?? event.scheduled_start_time);
  if (Number.isNaN(start.getTime())) {
    return [];
  }
  const durationMs = getEventDurationMs(event);
  const endLimit = rule.end ? new Date(rule.end) : new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(endLimit.getTime())) {
    return [];
  }
  const interval = Math.max(1, rule.interval ?? 1);
  if (recurrence === 'daily') {
    return buildDailyOccurrences(start, endLimit, interval, durationMs, rule);
  }
  if (recurrence === 'weekly') {
    return buildWeeklyOccurrences(start, endLimit, interval, durationMs, rule);
  }
  if (recurrence === 'monthly') {
    return buildMonthlySeries(start, endLimit, interval, durationMs, rule);
  }

  return [];
}

/**
 * Builds an occurrence object.
 */
function buildOccurrence(startAt: Date, endAt: Date) {
  return { startAt, endAt };
}

function getEventDurationMs(event: DiscordScheduledEvent) {
  const baseEnd = event.scheduled_end_time ? new Date(event.scheduled_end_time) : null;
  if (baseEnd && !Number.isNaN(baseEnd.getTime())) {
    return baseEnd.getTime() - new Date(event.scheduled_start_time).getTime();
  }
  return DEFAULT_DURATION_MS;
}

/**
 * Builds daily occurrences with optional weekday filtering.
 */
function buildDailyOccurrences(
  start: Date,
  endLimit: Date,
  interval: number,
  durationMs: number,
  rule: DiscordRecurrenceRule
) {
  const occurrences: Array<{ startAt: Date; endAt: Date }> = [];
  let cursor = new Date(start);
  while (cursor <= endLimit) {
    if (!rule.by_weekday || rule.by_weekday.includes(mapDiscordWeekday(cursor))) {
      occurrences.push(buildOccurrence(cursor, new Date(cursor.getTime() + durationMs)));
    }
    cursor = new Date(cursor.getTime() + interval * 24 * 60 * 60 * 1000);
  }
  return occurrences;
}

/**
 * Maps a JavaScript Date to a Discord weekday number.
 */
function buildWeeklyOccurrences(
  start: Date,
  endLimit: Date,
  interval: number,
  durationMs: number,
  rule: DiscordRecurrenceRule
) {
  const occurrences: Array<{ startAt: Date; endAt: Date }> = [];
  const weekdays = (rule.by_weekday && rule.by_weekday.length ? rule.by_weekday : [mapDiscordWeekday(start)])
    .slice()
    .sort((a, b) => a - b);
  let cursor = startOfWeek(start);
  let weekIndex = 0;
  while (cursor <= endLimit) {
    if (weekIndex % interval === 0) {
      for (const day of weekdays) {
        const jsDay = discordWeekdayToJs(day);
        const offset = (jsDay + 6) % 7;
        const date = addDays(cursor, offset);
        if (date < start || date > endLimit) {
          continue;
        }
        occurrences.push(buildOccurrence(date, new Date(date.getTime() + durationMs)));
      }
    }
    cursor = addDays(cursor, 7);
    weekIndex += 1;
  }
  return occurrences;
}

/**
 * Builds monthly occurrences based on the recurrence rule.
 */
function buildMonthlySeries(
  start: Date,
  endLimit: Date,
  interval: number,
  durationMs: number,
  rule: DiscordRecurrenceRule
) {
  const occurrences: Array<{ startAt: Date; endAt: Date }> = [];
  const months = rule.by_month && rule.by_month.length ? rule.by_month : null;
  let cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1, start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds())
  );
  let monthIndex = 0;
  while (cursor <= endLimit) {
    const monthNumber = cursor.getUTCMonth() + 1;
    if ((!months || months.includes(monthNumber)) && monthIndex % interval === 0) {
      const monthOccurrences = buildMonthlyOccurrences(cursor, start, rule, durationMs);
      monthOccurrences.forEach((occ) => {
        if (occ.startAt >= start && occ.startAt <= endLimit) {
          occurrences.push(occ);
        }
      });
    }
    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1, start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds())
    );
    monthIndex += 1;
  }
  return occurrences;
}

/**
 * Calculates the start of the week (Monday) for a given date.
 */
function startOfWeek(date: Date) {
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - diff,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds()
    )
  );
}

/**
 * Adds days to a date and returns a new date object.
 */
function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Converts Discord weekday to JavaScript weekday.
 */
function discordWeekdayToJs(day: number) {
  if (day === DiscordWeekday.SUNDAY) {
    return 0;
  }
  return day + 1;
}

/**
 * Builds occurrences for monthly recurrence rules.
 */
function buildMonthlyOccurrences(baseMonth: Date, start: Date, rule: DiscordRecurrenceRule, durationMs: number) {
  if (rule.by_n_weekday && rule.by_n_weekday.length) {
    return rule.by_n_weekday
      .map((entry) => {
        const date = nthWeekdayOfMonth(baseMonth, entry.day, entry.n);
        if (!date) {
          return null;
        }
        return buildOccurrence(date, new Date(date.getTime() + durationMs));
      })
      .filter((occ): occ is { startAt: Date; endAt: Date } => Boolean(occ));
  }
  const days = rule.by_month_day && rule.by_month_day.length ? rule.by_month_day : [start.getUTCDate()];
  return days
    .map((day) => {
      const date = new Date(Date.UTC(baseMonth.getUTCFullYear(), baseMonth.getUTCMonth(), day, start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds()));
      if (date.getUTCMonth() !== baseMonth.getUTCMonth()) {
        return null;
      }
      return buildOccurrence(date, new Date(date.getTime() + durationMs));
    })
    .filter((occ): occ is { startAt: Date; endAt: Date } => Boolean(occ));
}

/**
 * Calculates the nth weekday of the month for a given base month.
 */
function nthWeekdayOfMonth(baseMonth: Date, weekday: number, n: number) {
  if (n < 1 || n > 5) {
    return null;
  }
  const jsWeekday = discordWeekdayToJs(weekday);
  const first = new Date(Date.UTC(baseMonth.getUTCFullYear(), baseMonth.getUTCMonth(), 1, baseMonth.getUTCHours(), baseMonth.getUTCMinutes(), baseMonth.getUTCSeconds()));
  const firstDay = first.getUTCDay();
  let offset = jsWeekday - firstDay;
  if (offset < 0) {
    offset += 7;
  }
  const dayOfMonth = 1 + offset + (n - 1) * 7;
  const date = new Date(Date.UTC(baseMonth.getUTCFullYear(), baseMonth.getUTCMonth(), dayOfMonth, baseMonth.getUTCHours(), baseMonth.getUTCMinutes(), baseMonth.getUTCSeconds()));
  if (date.getUTCMonth() !== baseMonth.getUTCMonth()) {
    return null;
  }
  return date;
}

/**
 * Parses a stored recurrence rule JSON string.
 */
function parseStoredRecurrenceRule(value: string | null): DiscordRecurrenceRule | null {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as DiscordRecurrenceRule;
  } catch {
    return null;
  }
}

/**
 * Maps a Date to a Discord weekday.
 */
function mapDiscordWeekday(date: Date) {
  const day = date.getUTCDay();
  if (day === 0) {
    return DiscordWeekday.SUNDAY;
  }
  return day - 1;
}

/**
 * Parses the description to extract working group tag and cleaned description.
 */
function parseDescription(description?: string | null) {
  if (!description) {
    return { workingGroupName: null, cleaned: '' };
  }
  const lines = description.split('\n');
  let workingGroupName: string | null = null;
  const filtered = lines.filter((line) => {
    const match = line.match(/```working-group-id=(.+?)```/i);
    if (match) {
      workingGroupName = match[1].trim();
      return false;
    }
    return true;
  });
  return { workingGroupName, cleaned: filtered.join('\n').trim() };
}

/**
 * Resolves working group ID from name.
 */
function resolveWorkingGroupId(name: string | null) {
  console.log('Resolving working group', {
    requestedName: name,
  });
  if (name) {
    const group = findWorkingGroupByName(name);
    console.log('Working group lookup by name', {
      name,
      matchedId: group?.id ?? null,
    });
    if (group) {
      return group.id;
    }
  }
  return null;
}

/**
 * Determines if a link is an HTTP or HTTPS URL.
 */
function isHttpLink(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
