import { Router } from 'express';
import crypto from 'crypto';
import { authenticate, AuthedRequest, requireAdmin } from '../middleware/authenticate';
import {
  addEventAttendee,
  countAttendeesByEventIds,
  createEvent,
  deleteEventAttendee,
  deleteEventById,
  deleteEventsBySeries,
  deleteEventsByWorkingGroup,
  listEvents,
  listEventsBySeries,
  listUpcomingEvents,
  listUserEventIds,
  updateEvent,
  findEventById
} from '../repositories/eventRepository';
import {
  createWorkingGroup,
  findWorkingGroupById,
  listWorkingGroups,
  updateWorkingGroup,
  deleteWorkingGroup
} from '../repositories/workingGroupRepository';
import { serializeEvent, serializeWorkingGroup } from '../utils/serializer';
import { MonthlyPattern, RecurrenceRule } from '../types';

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
 * Deletes a working group and its events (admin only).
 */
/**
 * Deletes a working group and cascading events (duplicate safeguard).
 */
router.delete('/working-groups/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' });
  }
  const existing = findWorkingGroupById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Working group not found' });
  }
  deleteEventsByWorkingGroup(id);
  deleteWorkingGroup(id);
  return res.status(204).send();
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



router.delete('/working-groups/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' });
  }
  const existing = findWorkingGroupById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Working group not found' });
  }
  deleteEventsByWorkingGroup(id);
  deleteWorkingGroup(id);
  return res.status(204).send();
});

/**
 * Creates single or recurring events (admin only).
 */
router.post('/events', authenticate, requireAdmin, (req, res) => {
  const error = validateEvent(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const { name, description, workingGroupId, startAt, endAt, location, recurrence, seriesEndAt, monthlyPattern } = req.body as {
    name: string;
    description: string;
    workingGroupId: number;
    startAt: string;
    endAt: string;
    location: string;
    recurrence?: RecurrenceRule;
    seriesEndAt?: string | null;
    monthlyPattern?: MonthlyPattern;
  };

  const numericWorkingGroupId = Number(workingGroupId);
  const workingGroup = findWorkingGroupById(numericWorkingGroupId);
  if (!workingGroup) {
    return res.status(400).json({ error: 'workingGroupId must reference an existing working group' });
  }

  const baseStart = new Date(startAt);
  const baseEnd = new Date(endAt);
  const rule: RecurrenceRule = recurrence ?? 'none';
  const monthlyPatternValue: MonthlyPattern = monthlyPattern === 'weekday' ? 'weekday' : 'date';
  const seriesUuid = rule === 'none' ? null : crypto.randomUUID();
  const seriesEndDate = seriesEndAt ? new Date(seriesEndAt) : null;

    const expanded = expandRecurringEvents({
      baseEvent: {
        name: name.trim(),
        description: description.trim(),
        workingGroupId: numericWorkingGroupId,
        startAt: baseStart,
        endAt: baseEnd,
        location: location.trim(),
      },
      recurrence: rule,
      seriesEnd: seriesEndDate,
      seriesUuid,
      monthlyPattern: monthlyPatternValue,
    });

  const createdEvents = expanded.map((payload) =>
    createEvent(
      payload.name,
      payload.description,
      payload.workingGroupId,
      payload.startAt,
      payload.endAt,
      payload.location,
      payload.seriesUuid,
      payload.recurrence === 'none' ? null : payload.recurrence,
      payload.seriesEndAt
    )
  );

  const first = createdEvents[0];
  res.status(201).json({ event: serializeEvent({ ...first, working_group_name: workingGroup.name }) });
});

/**
 * Updates an event (or regenerates its recurrence) by ID.
 */
router.patch('/events/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' });


/**
 * Deletes a single event or an entire series depending on the payload.
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

  }

  const error = validateEvent(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const { name, description, workingGroupId, startAt, endAt, location, recurrence, seriesEndAt, monthlyPattern } = req.body as {
    name: string;
    description: string;
    workingGroupId: number;
    startAt: string;
    endAt: string;
    location: string;
    recurrence?: RecurrenceRule;
    seriesEndAt?: string | null;
    monthlyPattern?: MonthlyPattern;
  };

  const numericWorkingGroupId = Number(workingGroupId);
  const workingGroup = findWorkingGroupById(numericWorkingGroupId);
  if (!workingGroup) {
    return res.status(400).json({ error: 'workingGroupId must reference an existing working group' });
  }

  const existing = findEventById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const recurrenceRule: RecurrenceRule = recurrence ?? 'none';
  const monthlyPatternValue: MonthlyPattern = monthlyPattern === 'weekday' ? 'weekday' : 'date';
  const seriesEndDate = seriesEndAt ? new Date(seriesEndAt) : null;

  if (recurrenceRule !== 'none') {
    const seriesUuid = existing.series_uuid ?? crypto.randomUUID();
    if (existing.series_uuid) {
      deleteEventsBySeries(existing.series_uuid);
    } else {
      deleteEventById(id);
    }

    const baseStart = new Date(startAt);
    const baseEnd = new Date(endAt);
    const expanded = expandRecurringEvents({
      baseEvent: {
        name: name.trim(),
        description: description.trim(),
        workingGroupId: numericWorkingGroupId,
        startAt: baseStart,
        endAt: baseEnd,
        location: location.trim(),
      },
      recurrence: recurrenceRule,
      seriesEnd: seriesEndDate,
      seriesUuid,
      monthlyPattern: monthlyPatternValue,
    });

    const createdEvents = expanded.map((payload) =>
      createEvent(
        payload.name,
        payload.description,
        payload.workingGroupId,
        payload.startAt,
        payload.endAt,
        payload.location,
        payload.seriesUuid,
        payload.recurrence === 'none' ? null : payload.recurrence,
        payload.seriesEndAt
      )
    );
    const first = createdEvents[0];
    return res.json({ event: serializeEvent({ ...first, working_group_name: workingGroup.name }) });
  }

  if (existing.series_uuid) {
    deleteEventsBySeries(existing.series_uuid);
  }
  const single = updateEvent(
    id,
    name.trim(),
    description.trim(),
    numericWorkingGroupId,
    new Date(startAt).toISOString(),
    new Date(endAt).toISOString(),
    location.trim()
  );
  res.json({ event: single ? serializeEvent({ ...single, working_group_name: workingGroup.name }) : null });
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
function validateEvent(body: unknown) {
  const { name, description, workingGroupId, startAt, endAt, location, recurrence, monthlyPattern } =
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
  if (recurrence === 'monthly' && monthlyPattern && monthlyPattern !== 'date' && monthlyPattern !== 'weekday') {
    return 'monthlyPattern must be "date" or "weekday"';
  }
  return null;
}

/**
 * Expands a base event into all recurring instances based on the rule provided.
 */
function expandRecurringEvents(params: {
  baseEvent: {
    name: string;
    description: string;
    workingGroupId: number;
    startAt: Date;
    endAt: Date;
    location: string;
  };
  recurrence: RecurrenceRule;
  seriesEnd: Date | null;
  seriesUuid: string | null;
  monthlyPattern?: MonthlyPattern;
}) {
  const { baseEvent, recurrence, seriesEnd, seriesUuid, monthlyPattern = 'date' } = params;
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
    seriesUuid,
    recurrence,
    seriesEndAt: seriesEnd ? seriesEnd.toISOString() : null,
  });

  if (recurrence === 'none' || !seriesEnd) {
    return events;
  }

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
    const nextEnd = new Date(nextStart.getTime() + durationMs);
    events.push({
      name: baseEvent.name,
      description: baseEvent.description,
      workingGroupId: baseEvent.workingGroupId,
      startAt: nextStart.toISOString(),
      endAt: nextEnd.toISOString(),
      location: baseEvent.location,
      seriesUuid,
      recurrence,
      seriesEndAt: seriesEnd ? seriesEnd.toISOString() : null,
    });
    cursorStart = nextStart;
  }

  return events;
}

/**
 * Calculates the next recurrence start date based on the rule.
 */
function getNextOccurrenceStart(
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
 * Finds the next occurrence matching the nth weekday of a month.
 */
function getNextMonthlyWeekday(current: Date, weekIndex: number, weekday: number, referenceStart: Date) {
  const candidate = new Date(current);
  candidate.setMonth(candidate.getMonth() + 1);
  const year = candidate.getFullYear();
  const month = candidate.getMonth();
  return getNthWeekdayOfMonth(year, month, weekIndex, weekday, referenceStart);
}

/**
 * Returns the Date for the nth weekday (e.g., 2nd Tuesday) in the given month.
 */
function getNthWeekdayOfMonth(
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

export default router;
