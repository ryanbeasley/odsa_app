import { RequestHandler } from 'express';
import { AuthedRequest } from '../middleware/authenticate';
import {
  addEventAttendee,
  deleteEventAttendee,
  deleteEventById,
  deleteEventsBySeries,
  listEventsBySeries,
  findEventById,
} from '../repositories/eventRepository';
import {
  createEvents,
  getEvents,
  updateEvents,
} from '../services/eventService';
import { CreateEventPayload, SeriesTogglePayload, UpdateEventPayload } from '../validation/eventsSchemas';
import { EventIdPayload } from '../validation/eventsParamsSchemas';
import { RequestUser } from '../middleware/authenticate';

/**
 * Returns upcoming events grouped by series along with attendance info.
 */
export const listEventsHandler: RequestHandler = (req: AuthedRequest, res) => {
  const userId = (req.user as RequestUser).id;
  return res.json({ events: getEvents(userId) });
};

/**
 * Creates single or recurring events (admin only).
 */
export const createEventHandler: RequestHandler = (req, res) => {
  void createEvents(req.validated as CreateEventPayload).then((serializedEvent) => {
    res.status(201).json({ event: serializedEvent });
  });
};

/**
 * Updates an event (or regenerates its recurrence) by ID.
 */
export const updateEventHandler: RequestHandler = (req, res) => {
  const { payload, normalized } = req.validated as UpdateEventPayload;
  const { id } = req.validatedQuery as EventIdPayload;
  void updateEvents(payload, normalized, id).then((response) => {
    res.json({ event: response });
  });
};

/**
 * Deletes a single event or series (duplicate definition retained for clarity).
 */
export const deleteEventHandler: RequestHandler = (req, res) => {
  const { id } = req.validatedQuery as EventIdPayload;
  const { series } = req.validated as SeriesTogglePayload;
  const existing = findEventById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Event not found' });
  }
  if (series && existing.series_uuid) {
    deleteEventsBySeries(existing.series_uuid);
  } else {
    deleteEventById(id);
  }
  return res.status(204).send();
};

/**
 * Adds the authenticated user as an attendee for an event/series.
 */
export const addAttendeeHandler: RequestHandler = (req, res) => {
  if (!(req as AuthedRequest).user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { id } = req.validatedQuery as EventIdPayload;
  const { series } = req.validated as SeriesTogglePayload;
  const applySeries = Boolean(series);
  const existing = findEventById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const targetEvents =
    applySeries && existing.series_uuid ? listEventsBySeries(existing.series_uuid) : [existing];

  targetEvents.forEach((evt) => {
    addEventAttendee((req as AuthedRequest).user!.id, evt.id);
  });

  return res.status(201).json({ attending: true });
};

/**
 * Removes the authenticated user from an event/series attendee list.
 */
export const removeAttendeeHandler: RequestHandler = (req, res) => {
  if (!(req as AuthedRequest).user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { id } = req.validatedQuery as EventIdPayload;
  const { series } = req.validated as SeriesTogglePayload;
  const applySeries = Boolean(series);
  const existing = findEventById(id);
  if (!existing) {
    throw new Error('Event not found');
  }
  const targetEvents =
    (applySeries && existing.series_uuid)
      ? listEventsBySeries(existing.series_uuid)
      : [existing];
  targetEvents.forEach((evt) => {
    deleteEventAttendee((req as AuthedRequest).user!.id, evt.id);
  });
  return res.status(204).json({ attending: false });
};
