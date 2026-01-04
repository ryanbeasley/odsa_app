import { Router } from 'express';
import crypto from 'node:crypto';
import { authenticate, AuthedRequest, requireAdmin } from '../middleware/authenticate';
import {
  addEventAttendee,
  countAttendeesByEventIds,
  createEvent,
  deleteEventAttendee,
  deleteEventById,
  deleteEventsBySeries,
  deleteEventsByWorkingGroup,
  listEventsBySeries,
  listUpcomingEvents,
  listUserEventIds,
  findEventById,
  updateEventDiscordId
} from '../repositories/eventRepository';
import {
  createWorkingGroup,
  findWorkingGroupById,
  listWorkingGroups,
  updateWorkingGroup,
  deleteWorkingGroup
} from '../repositories/workingGroupRepository';
import { serializeEvent, serializeWorkingGroup } from '../utils/serializer';
import { createDiscordEventFromApp } from '../services/discordService';
import {
  expandRecurringEvents,
  normalizeDisplayName,
  normalizeRecurrenceRuleInput,
  validateEvent,
  validateEventPayload,
  updateRecurringSeries,
  updateSingleEvent,
  syncDiscordEvent,
} from '../services/eventService';
import { EventPayload } from '../types';

type DiscordRecurrenceRuleInput = EventPayload['recurrenceRule'];

const router = Router();

/**
 * Lists all working groups (auth required).
 */
router.get('/working-groups', authenticate, (_req, res) => {
  const groups = listWorkingGroups().map(serializeWorkingGroup);
  res.json({ groups });
});

/**
 * Creates a new working group (admin only).
 */
router.post('/working-groups', authenticate, requireAdmin, (req, res) => {
  const { name, description, members } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'description is required' });
  }
  if (typeof members !== 'string' || !members.trim()) {
    return res.status(400).json({ error: 'members is required' });
  }
  const created = createWorkingGroup(name.trim(), description.trim(), members.trim());
  return res.status(201).json({ group: serializeWorkingGroup(created) });
});

/**
 * Updates a working group by ID (admin only).
 */
router.patch('/working-groups/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' });
  }
  const { name, description, members } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'description is required' });
  }
  if (typeof members !== 'string' || !members.trim()) {
    return res.status(400).json({ error: 'members is required' });
  }
  const updated = updateWorkingGroup(id, name.trim(), description.trim(), members.trim());
  if (!updated) {
    return res.status(404).json({ error: 'Working group not found' });
  }
  return res.json({ group: serializeWorkingGroup(updated) });
});

/**
 * Returns upcoming events grouped by series along with attendance info.
 */
router.get('/events', authenticate, (req, res) => {
  const userId = (req as AuthedRequest).user?.id ?? null;
  const userEventIds = userId ? new Set(listUserEventIds(userId)) : new Set<number>();

  const nowIso = new Date().toISOString();
  const eventsRaw = listUpcomingEvents(nowIso);
  const attendeeCounts = countAttendeesByEventIds(eventsRaw.map((e) => e.id));
  const events = eventsRaw.map((evt) => {
    const serialized = serializeEvent(evt);
    const attending = userEventIds.has(evt.id);
    return {
      ...serialized,
      attending,
      attendeeCount: attendeeCounts[evt.id] ?? 0,
    };
  });

  const grouped = events.reduce<Record<string, { upcoming: typeof events; next: typeof events[number] }>>((acc, evt) => {
    const key = evt.seriesUuid ?? `single-${evt.id}`;
    if (!acc[key]) {
      acc[key] = { upcoming: [], next: evt };
    }
    acc[key].upcoming.push(evt);
    if (new Date(evt.startAt).getTime() < new Date(acc[key].next.startAt).getTime()) {
      acc[key].next = evt;
    }
    return acc;
  }, {});

  const response = Object.values(grouped).map(({ next, upcoming }) => ({
    ...next,
    attending: next.attending || (next.seriesUuid ? upcoming.some((e) => e.attending) : false),
    upcomingOccurrences: upcoming
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, 5)
      .map((e) => ({
        eventId: e.id,
        startAt: e.startAt,
        attendeeCount: e.attendeeCount ?? 0,
        attending: Boolean(e.attending),
      })),
  }));

  res.json({ events: response });
});

/**
 * deletes a working group by its id
 */
router.delete('/working-groups/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    console.log('Invalid working group ID for deletion:', id);
    return res.status(400).json({ error: 'id must be a positive number' });
  }
  const existing = findWorkingGroupById(id);
  if (!existing) {
    console.log('Working group not found for ID:', id);
    return res.status(404).json({ error: 'Working group not found' });
  }
  deleteEventsByWorkingGroup(id);
  deleteWorkingGroup(id);
  console.log('Deleted working group with ID:', id);
  return res.status(204).send();
});

/**
 * Creates single or recurring events (admin only).
 */
router.post('/events', authenticate, requireAdmin, async (req, res) => {
  const error = validateEvent(req.body);
  if (error) {
    console.log('Event validation error:', error);
    return res.status(400).json({ error });
  }
  const { name, description, workingGroupId, startAt, endAt, location, locationDisplayName, createDiscordEvent, recurrenceRule, seriesEndAt } = req.body as {
    name: string;
    description: string;
    workingGroupId: number;
    startAt: string;
    endAt: string;
    location: string;
    locationDisplayName?: string | null;
    createDiscordEvent?: boolean;
    recurrenceRule?: DiscordRecurrenceRuleInput | null;
    seriesEndAt?: string | null;
  };

  const numericWorkingGroupId = Number(workingGroupId);
  const workingGroup = findWorkingGroupById(numericWorkingGroupId);
  if (!workingGroup) {
    console.log('Working group not found for ID:', numericWorkingGroupId);
    return res.status(400).json({ error: 'workingGroupId must reference an existing working group' });
  }

  const baseStart = new Date(startAt);
  const baseEnd = new Date(endAt);
  const normalized = normalizeRecurrenceRuleInput(recurrenceRule, baseStart);
  if ('error' in normalized) {
    return res.status(400).json({ error: normalized.error });
  }
  const { recurrence, monthlyPattern, rule: normalizedRule, dailyWeekdays } = normalized;
  const seriesUuid = recurrence === 'none' ? null : crypto.randomUUID();
  const seriesEndDate = seriesEndAt ? new Date(seriesEndAt) : null;
  const recurrenceRuleJson = normalizedRule ? JSON.stringify(normalizedRule) : null;

  const expanded = expandRecurringEvents({
      baseEvent: {
        name: name.trim(),
        description: description.trim(),
        workingGroupId: numericWorkingGroupId,
        startAt: baseStart,
        endAt: baseEnd,
        location: location.trim(),
        locationDisplayName: normalizeDisplayName(locationDisplayName),
      },
      recurrence,
      seriesEnd: seriesEndDate,
      seriesUuid,
      monthlyPattern,
      dailyWeekdays,
      recurrenceRuleJson,
    });

  const createdEvents = expanded.map((payload) =>
    createEvent(
      payload.name,
      payload.description,
      payload.workingGroupId,
      payload.startAt,
      payload.endAt,
      payload.location,
      payload.locationDisplayName,
      payload.seriesUuid,
      payload.recurrenceRuleJson ?? null,
      payload.seriesEndAt
    )
  );
  console.log('Created events with IDs:', createdEvents.map((e) => e.id));

  if (createDiscordEvent) {
    const target = createdEvents[0];
    const discordEventId = await createDiscordEventFromApp(target);
    updateEventDiscordId(target.id, discordEventId);
    target.discord_event_id = discordEventId;
    console.log('Created Discord event with ID:', discordEventId);
  }

  const first = createdEvents[0];
  res.status(201).json({ event: serializeEvent({ ...first, working_group_name: workingGroup.name }) });
});

/**
 * Updates an event (or regenerates its recurrence) by ID.
 */
router.patch('/events/:id', authenticate, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' });
  }

  const validated = validateEventPayload(req.body);
  if ('error' in validated) {
    console.log('Event validation error:', validated.error);
    return res.status(400).json({ error: validated.error });
  }

  const { payload, normalized } = validated;
  const workingGroup = findWorkingGroupById(payload.workingGroupId);
  if (!workingGroup) {
    console.log('Working group not found for ID:', payload.workingGroupId);
    return res.status(400).json({ error: 'workingGroupId must reference an existing working group' });
  }

  const existing = findEventById(id);
  if (!existing) {
    console.log('Event not found for ID:', id);
    return res.status(404).json({ error: 'Event not found' });
  }

  const seriesEndDate = payload.seriesEndAt ? new Date(payload.seriesEndAt) : null;
  const recurrenceRuleJson = normalized.rule ? JSON.stringify(normalized.rule) : null;

  const updated =
    normalized.recurrence !== 'none'
      ? await updateRecurringSeries({
          id,
          existing,
          payload,
          normalized,
          seriesEndDate,
          recurrenceRuleJson,
        })
      : await updateSingleEvent({
          id,
          existing,
          payload,
          recurrenceRuleJson,
        });

  if (payload.createDiscordEvent && updated) {
    await syncDiscordEvent(updated);
  }

  return res.json({ event: updated ? serializeEvent({ ...updated, working_group_name: workingGroup.name }) : null });
});

/**
 * Deletes a single event or series (duplicate definition retained for clarity).
 */
router.delete('/events/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' });
  }
  const existing = findEventById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Event not found' });
  }
  const { series } = req.body ?? {};
  if (series && existing.series_uuid) {
    deleteEventsBySeries(existing.series_uuid);
  } else {
    deleteEventById(id);
  }
  return res.status(204).send();
});

/**
 * Adds the authenticated user as an attendee for an event/series.
 */
router.post('/events/:id/attendees', authenticate, (req: AuthedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' });
  }
  const applySeries = Boolean(req.body?.series);
  const existing = findEventById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const targetEvents =
    applySeries && existing.series_uuid ? listEventsBySeries(existing.series_uuid) : [existing];

  targetEvents.forEach((evt) => {
    addEventAttendee(req.user!.id, evt.id);
  });

  return res.status(201).json({ attending: true });
});

/**
 * Removes the authenticated user from an event/series attendee list.
 */
router.delete('/events/:id/attendees', authenticate, (req: AuthedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' });
  }
  const applySeries = Boolean(req.body?.series);
  const existing = findEventById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const targetEvents =
    applySeries && existing.series_uuid ? listEventsBySeries(existing.series_uuid) : [existing];

  targetEvents.forEach((evt) => {
    deleteEventAttendee(req.user!.id, evt.id);
  });

  return res.status(204).json({ attending: false });
});

/**
 * Validates the incoming event payload and returns an error message, if any.
 */
export default router;
