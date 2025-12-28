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
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
    throw new Error('Discord is not configured on the server.');
  }
  console.log('[discord-sync] Starting sync for guild', DISCORD_GUILD_ID);
  const events = await fetchDiscordEvents();
  console.log('[discord-sync] Fetched', events.length, 'scheduled events');
  let createdOrUpdated = 0;
  let skipped = 0;
  for (const event of events) {
    console.log('[discord-sync] Processing event', {
      id: event.id,
      name: event.name,
      description: event.description ?? null,
      start: event.scheduled_start_time,
      end: event.scheduled_end_time ?? null,
      entityType: event.entity_type,
      location: event.entity_metadata?.location ?? null,
      channelId: event.channel_id ?? null,
    });
    if (!event.scheduled_start_time) {
      console.log('[discord-sync] Skipping event without start time', event.id);
      skipped += 1;
      continue;
    }
    const startAt = new Date(event.scheduled_start_time);
    if (Number.isNaN(startAt.getTime())) {
      console.log('[discord-sync] Skipping event with invalid start time', event.id);
      skipped += 1;
      continue;
    }
    const endAt = event.scheduled_end_time ? new Date(event.scheduled_end_time) : new Date(startAt.getTime() + DEFAULT_DURATION_MS);
    const parsedDescription = parseDescription(event.description);
    const workingGroupId = resolveWorkingGroupId(parsedDescription.workingGroupName);
    if (!workingGroupId) {
      console.log('[discord-sync] Skipping event without matching working group', event.id, parsedDescription.workingGroupName ?? '');
      skipped += 1;
      continue;
    }
    const locationDetails = buildLocationDetails(event);
    if (event.recurrence_rule && mapDiscordRecurrence(event.recurrence_rule)) {
      const result = upsertDiscordSeriesEvent({
        event,
        workingGroupId,
        description: parsedDescription.cleaned || 'Discord event',
        location: locationDetails.link,
        locationDisplayName: locationDetails.displayName,
      });
      createdOrUpdated += result;
      continue;
    }
    upsertDiscordEvent({
      discordEventId: event.id,
      name: event.name.trim(),
      description: parsedDescription.cleaned || 'Discord event',
      workingGroupId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      location: locationDetails.link,
      locationDisplayName: locationDetails.displayName,
    });
    createdOrUpdated += 1;
  }

  console.log('[discord-sync] Sync complete', { createdOrUpdated, skipped });
  return { count: createdOrUpdated, skipped };
}

export async function createDiscordEventFromApp(event: EventRow) {
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

function buildLocationDetails(event: DiscordScheduledEvent) {
  if (event.entity_type === 3) {
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
  const displayName = event.entity_type === 1 ? 'Discord stage' : 'Discord voice';
  return { link, displayName };
}

function buildDiscordEventPayload(event: EventRow) {
  const location = (event.location_display_name ?? event.location ?? 'TBD').trim();
  const groupName = event.working_group_id ? findWorkingGroupById(event.working_group_id)?.name ?? null : null;
  const workingGroupTag = groupName ? `\n\n\`\`\`working-group-id=${groupName}\`\`\`` : '';
  const recurrenceRule = buildDiscordRecurrenceRule(event);
  const payload: Record<string, unknown> = {
    name: event.name,
    description: `${event.description}${workingGroupTag}`,
    scheduled_start_time: new Date(event.start_at).toISOString(),
    scheduled_end_time: new Date(event.end_at).toISOString(),
    privacy_level: 2,
    entity_type: 3,
    entity_metadata: {
      location,
    },
  };
  if (recurrenceRule) {
    payload.recurrence_rule = recurrenceRule;
  }
  return payload;
}

function ensureDiscordConfigured() {
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
    throw new Error('Discord is not configured on the server.');
  }
}

function upsertDiscordSeriesEvent(params: {
  event: DiscordScheduledEvent;
  workingGroupId: number;
  description: string;
  location: string;
  locationDisplayName: string | null;
}) {
  const { event, workingGroupId, description, location, locationDisplayName } = params;
  const occurrences = buildSeriesOccurrences(event);
  if (!occurrences.length) {
    return 0;
  }
  const existing = findEventByDiscordEventId(event.id);
  if (existing?.series_uuid) {
    deleteEventsBySeries(existing.series_uuid);
  } else if (existing) {
    deleteEventById(existing.id);
  }
  const seriesUuid = randomUUID();
  const seriesEndAt = occurrences[occurrences.length - 1].endAt.toISOString();
  const recurrence = mapDiscordRecurrence(event.recurrence_rule);
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
      recurrence,
      seriesEndAt
    );
    if (index === 0) {
      updateEventDiscordId(created.id, event.id);
    }
  });
  return occurrences.length;
}

function mapDiscordRecurrence(rule?: DiscordRecurrenceRule | null) {
  if (!rule) {
    return null;
  }
  if (rule.frequency === 3) {
    return 'daily';
  }
  if (rule.frequency === 2) {
    return 'weekly';
  }
  if (rule.frequency === 1) {
    return 'monthly';
  }
  return null;
}

function buildSeriesOccurrences(event: DiscordScheduledEvent) {
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
  const baseEnd = event.scheduled_end_time ? new Date(event.scheduled_end_time) : null;
  const durationMs = baseEnd && !Number.isNaN(baseEnd.getTime()) ? baseEnd.getTime() - new Date(event.scheduled_start_time).getTime() : DEFAULT_DURATION_MS;
  const endLimit = rule.end ? new Date(rule.end) : new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(endLimit.getTime())) {
    return [];
  }
  const interval = Math.max(1, rule.interval ?? 1);
  const occurrences: Array<{ startAt: Date; endAt: Date }> = [];

  if (recurrence === 'daily') {
    let cursor = new Date(start);
    while (cursor <= endLimit) {
      occurrences.push(buildOccurrence(cursor, new Date(cursor.getTime() + durationMs)));
      cursor = new Date(cursor.getTime() + interval * 24 * 60 * 60 * 1000);
    }
    return occurrences;
  }

  if (recurrence === 'weekly') {
    const weekdays = (rule.by_weekday && rule.by_weekday.length ? rule.by_weekday : [mapDiscordWeekday(start)]).slice().sort((a, b) => a - b);
    let cursor = startOfWeek(start);
    let weekIndex = 0;
    while (cursor <= endLimit) {
      if (weekIndex % interval === 0) {
        for (const day of weekdays) {
          const date = addDays(cursor, discordWeekdayToJs(day));
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

  if (recurrence === 'monthly') {
    const months = rule.by_month && rule.by_month.length ? rule.by_month : null;
    let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1, start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds()));
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
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1, start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds()));
      monthIndex += 1;
    }
    return occurrences;
  }

  return occurrences;
}

function buildOccurrence(startAt: Date, endAt: Date) {
  return { startAt, endAt };
}

function startOfWeek(date: Date) {
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diff, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function discordWeekdayToJs(day: number) {
  if (day === 6) {
    return 0;
  }
  return day + 1;
}

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

function buildDiscordRecurrenceRule(event: EventRow) {
  if (!event.recurrence || event.recurrence === 'none') {
    return null;
  }
  const start = new Date(event.start_at);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  const frequency = event.recurrence === 'daily' ? 3 : event.recurrence === 'weekly' ? 2 : 1;
  const rule: Record<string, unknown> = {
    start: start.toISOString(),
    frequency,
    interval: 1,
  };

  if (event.recurrence === 'weekly') {
    rule.by_weekday = [mapDiscordWeekday(start)];
  }

  if (event.recurrence === 'monthly') {
    rule.by_month_day = [start.getUTCDate()];
  }

  return rule;
}

function mapDiscordWeekday(date: Date) {
  const day = date.getUTCDay();
  if (day === 0) {
    return 6;
  }
  return day - 1;
}

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

function resolveWorkingGroupId(name: string | null) {
  console.log('[discord-sync] Resolving working group', {
    requestedName: name,
  });
  if (name) {
    const group = findWorkingGroupByName(name);
    console.log('[discord-sync] Working group lookup by name', {
      name,
      matchedId: group?.id ?? null,
    });
    if (group) {
      return group.id;
    }
  }
  return null;
}

function isHttpLink(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
