import { RouteDefinition } from './types';
import { createEventSchema, seriesToggleSchema, updateEventSchema } from '../validation/eventsSchemas';
import { eventIdSchema } from '../validation/eventsParamsSchemas';
import {
  listEventsHandler,
  createEventHandler,
  updateEventHandler,
  deleteEventHandler,
  addAttendeeHandler,
  removeAttendeeHandler,
} from '../controllers/eventsController';

export const eventsRoutes: RouteDefinition[] = [
  { method: 'GET', path: '/events', handler: listEventsHandler },
  {
    method: 'POST',
    path: '/events',
    handler: createEventHandler,
    schema: createEventSchema,
    admin: true,
  },
  {
    method: 'PATCH',
    path: '/events/:id',
    handler: updateEventHandler,
    schema: updateEventSchema,
    querySchema: eventIdSchema,
    admin: true,
  },
  {
    method: 'DELETE',
    path: '/events/:id',
    handler: deleteEventHandler,
    schema: seriesToggleSchema,
    querySchema: eventIdSchema,
    admin: true,
  },
  {
    method: 'POST',
    path: '/events/:id/attendees',
    handler: addAttendeeHandler,
    schema: seriesToggleSchema,
    querySchema: eventIdSchema,
  },
  {
    method: 'DELETE',
    path: '/events/:id/attendees',
    handler: removeAttendeeHandler,
    schema: seriesToggleSchema,
    querySchema: eventIdSchema,
  },
];
