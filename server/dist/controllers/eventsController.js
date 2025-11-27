"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const authenticate_1 = require("../middleware/authenticate");
const eventRepository_1 = require("../repositories/eventRepository");
const workingGroupRepository_1 = require("../repositories/workingGroupRepository");
const serializer_1 = require("../utils/serializer");
const router = (0, express_1.Router)();
router.get('/working-groups', authenticate_1.authenticate, (_req, res) => {
    const groups = (0, workingGroupRepository_1.listWorkingGroups)().map(serializer_1.serializeWorkingGroup);
    res.json({ groups });
});
router.post('/working-groups', authenticate_1.authenticate, authenticate_1.requireAdmin, (req, res) => {
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
    const created = (0, workingGroupRepository_1.createWorkingGroup)(name.trim(), description.trim(), members.trim());
    return res.status(201).json({ group: (0, serializer_1.serializeWorkingGroup)(created) });
});
router.patch('/working-groups/:id', authenticate_1.authenticate, authenticate_1.requireAdmin, (req, res) => {
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
    const updated = (0, workingGroupRepository_1.updateWorkingGroup)(id, name.trim(), description.trim(), members.trim());
    if (!updated) {
        return res.status(404).json({ error: 'Working group not found' });
    }
    return res.json({ group: (0, serializer_1.serializeWorkingGroup)(updated) });
});
router.delete('/working-groups/:id', authenticate_1.authenticate, authenticate_1.requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'id must be a positive number' });
    }
    const existing = (0, workingGroupRepository_1.findWorkingGroupById)(id);
    if (!existing) {
        return res.status(404).json({ error: 'Working group not found' });
    }
    (0, eventRepository_1.deleteEventsByWorkingGroup)(id);
    (0, workingGroupRepository_1.deleteWorkingGroup)(id);
    return res.status(204).send();
});
router.get('/events', authenticate_1.authenticate, (req, res) => {
    const userId = req.user?.id ?? null;
    const userEventIds = userId ? new Set((0, eventRepository_1.listUserEventIds)(userId)) : new Set();
    const nowIso = new Date().toISOString();
    const eventsRaw = (0, eventRepository_1.listUpcomingEvents)(nowIso);
    const attendeeCounts = (0, eventRepository_1.countAttendeesByEventIds)(eventsRaw.map((e) => e.id));
    const events = eventsRaw.map((evt) => {
        const serialized = (0, serializer_1.serializeEvent)(evt);
        const attending = userEventIds.has(evt.id);
        return {
            ...serialized,
            attending,
            attendeeCount: attendeeCounts[evt.id] ?? 0,
        };
    });
    const grouped = events.reduce((acc, evt) => {
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
router.delete('/working-groups/:id', authenticate_1.authenticate, authenticate_1.requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'id must be a positive number' });
    }
    const existing = (0, workingGroupRepository_1.findWorkingGroupById)(id);
    if (!existing) {
        return res.status(404).json({ error: 'Working group not found' });
    }
    (0, eventRepository_1.deleteEventsByWorkingGroup)(id);
    (0, workingGroupRepository_1.deleteWorkingGroup)(id);
    return res.status(204).send();
});
router.post('/events', authenticate_1.authenticate, authenticate_1.requireAdmin, (req, res) => {
    const error = validateEvent(req.body);
    if (error) {
        return res.status(400).json({ error });
    }
    const { name, description, workingGroupId, startAt, endAt, location, recurrence, seriesEndAt, monthlyPattern } = req.body;
    const numericWorkingGroupId = Number(workingGroupId);
    const workingGroup = (0, workingGroupRepository_1.findWorkingGroupById)(numericWorkingGroupId);
    if (!workingGroup) {
        return res.status(400).json({ error: 'workingGroupId must reference an existing working group' });
    }
    const baseStart = new Date(startAt);
    const baseEnd = new Date(endAt);
    const rule = recurrence ?? 'none';
    const monthlyPatternValue = monthlyPattern === 'weekday' ? 'weekday' : 'date';
    const seriesUuid = rule === 'none' ? null : crypto_1.default.randomUUID();
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
    const createdEvents = expanded.map((payload) => (0, eventRepository_1.createEvent)(payload.name, payload.description, payload.workingGroupId, payload.startAt, payload.endAt, payload.location, payload.seriesUuid, payload.recurrence === 'none' ? null : payload.recurrence, payload.seriesEndAt));
    const first = createdEvents[0];
    res.status(201).json({ event: (0, serializer_1.serializeEvent)({ ...first, working_group_name: workingGroup.name }) });
});
router.patch('/events/:id', authenticate_1.authenticate, authenticate_1.requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'id must be a positive number' });
        router.delete('/events/:id', authenticate_1.authenticate, authenticate_1.requireAdmin, (req, res) => {
            const id = Number(req.params.id);
            if (!Number.isFinite(id) || id <= 0) {
                return res.status(400).json({ error: 'id must be a positive number' });
            }
            const existing = (0, eventRepository_1.findEventById)(id);
            if (!existing) {
                return res.status(404).json({ error: 'Event not found' });
            }
            const { series } = req.body ?? {};
            if (series && existing.series_uuid) {
                (0, eventRepository_1.deleteEventsBySeries)(existing.series_uuid);
            }
            else {
                (0, eventRepository_1.deleteEventById)(id);
            }
            return res.status(204).send();
        });
    }
    const error = validateEvent(req.body);
    if (error) {
        return res.status(400).json({ error });
    }
    const { name, description, workingGroupId, startAt, endAt, location, recurrence, seriesEndAt, monthlyPattern } = req.body;
    const numericWorkingGroupId = Number(workingGroupId);
    const workingGroup = (0, workingGroupRepository_1.findWorkingGroupById)(numericWorkingGroupId);
    if (!workingGroup) {
        return res.status(400).json({ error: 'workingGroupId must reference an existing working group' });
    }
    const existing = (0, eventRepository_1.findEventById)(id);
    if (!existing) {
        return res.status(404).json({ error: 'Event not found' });
    }
    const recurrenceRule = recurrence ?? 'none';
    const monthlyPatternValue = monthlyPattern === 'weekday' ? 'weekday' : 'date';
    const seriesEndDate = seriesEndAt ? new Date(seriesEndAt) : null;
    if (recurrenceRule !== 'none') {
        const seriesUuid = existing.series_uuid ?? crypto_1.default.randomUUID();
        if (existing.series_uuid) {
            (0, eventRepository_1.deleteEventsBySeries)(existing.series_uuid);
        }
        else {
            (0, eventRepository_1.deleteEventById)(id);
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
        const createdEvents = expanded.map((payload) => (0, eventRepository_1.createEvent)(payload.name, payload.description, payload.workingGroupId, payload.startAt, payload.endAt, payload.location, payload.seriesUuid, payload.recurrence === 'none' ? null : payload.recurrence, payload.seriesEndAt));
        const first = createdEvents[0];
        return res.json({ event: (0, serializer_1.serializeEvent)({ ...first, working_group_name: workingGroup.name }) });
    }
    if (existing.series_uuid) {
        (0, eventRepository_1.deleteEventsBySeries)(existing.series_uuid);
    }
    const single = (0, eventRepository_1.updateEvent)(id, name.trim(), description.trim(), numericWorkingGroupId, new Date(startAt).toISOString(), new Date(endAt).toISOString(), location.trim());
    res.json({ event: single ? (0, serializer_1.serializeEvent)({ ...single, working_group_name: workingGroup.name }) : null });
});
router.delete('/events/:id', authenticate_1.authenticate, authenticate_1.requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'id must be a positive number' });
    }
    const existing = (0, eventRepository_1.findEventById)(id);
    if (!existing) {
        return res.status(404).json({ error: 'Event not found' });
    }
    const { series } = req.body ?? {};
    if (series && existing.series_uuid) {
        (0, eventRepository_1.deleteEventsBySeries)(existing.series_uuid);
    }
    else {
        (0, eventRepository_1.deleteEventById)(id);
    }
    return res.status(204).send();
});
router.post('/events/:id/attendees', authenticate_1.authenticate, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'id must be a positive number' });
    }
    const applySeries = Boolean(req.body?.series);
    const existing = (0, eventRepository_1.findEventById)(id);
    if (!existing) {
        return res.status(404).json({ error: 'Event not found' });
    }
    const targetEvents = applySeries && existing.series_uuid ? (0, eventRepository_1.listEventsBySeries)(existing.series_uuid) : [existing];
    targetEvents.forEach((evt) => {
        (0, eventRepository_1.addEventAttendee)(req.user.id, evt.id);
    });
    return res.status(201).json({ attending: true });
});
router.delete('/events/:id/attendees', authenticate_1.authenticate, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'id must be a positive number' });
    }
    const applySeries = Boolean(req.body?.series);
    const existing = (0, eventRepository_1.findEventById)(id);
    if (!existing) {
        return res.status(404).json({ error: 'Event not found' });
    }
    const targetEvents = applySeries && existing.series_uuid ? (0, eventRepository_1.listEventsBySeries)(existing.series_uuid) : [existing];
    targetEvents.forEach((evt) => {
        (0, eventRepository_1.deleteEventAttendee)(req.user.id, evt.id);
    });
    return res.status(204).json({ attending: false });
});
function validateEvent(body) {
    const { name, description, workingGroupId, startAt, endAt, location, recurrence, monthlyPattern } = (body ?? {});
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
function expandRecurringEvents(params) {
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
function getNextOccurrenceStart(currentStart, recurrence, monthlyPattern, weekIndex, weekday, referenceStart) {
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
function getNextMonthlyWeekday(current, weekIndex, weekday, referenceStart) {
    const candidate = new Date(current);
    candidate.setMonth(candidate.getMonth() + 1);
    const year = candidate.getFullYear();
    const month = candidate.getMonth();
    return getNthWeekdayOfMonth(year, month, weekIndex, weekday, referenceStart);
}
function getNthWeekdayOfMonth(year, month, nth, weekday, referenceStart) {
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
exports.default = router;
