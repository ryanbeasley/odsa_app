import { ValidationError } from '../middleware/validate';
import { validateEvent, validateEventPayload } from '../services/eventService';
import { EventPayload, NormalizedRecurrence } from '../types';
import { Schema } from './types';

export type WorkingGroupPayload = {
  name: string;
  description: string;
  members: string;
};

export const workingGroupSchema: Schema<WorkingGroupPayload> = {
  parse(input: unknown) {
    const { name, description, members } = (input ?? {}) as Record<string, unknown>;
    if (typeof name !== 'string' || !name.trim()) {
      throw new ValidationError('name is required');
    }
    if (typeof description !== 'string' || !description.trim()) {
      throw new ValidationError('description is required');
    }
    if (typeof members !== 'string' || !members.trim()) {
      throw new ValidationError('members is required');
    }
    return { name: name.trim(), description: description.trim(), members: members.trim() };
  },
};

export type CreateEventPayload = EventPayload;

export const createEventSchema: Schema<CreateEventPayload> = {
  parse(input: unknown) {
    const error = validateEvent(input);
    if (error) {
      throw new ValidationError(error);
    }
    return input as EventPayload;
  },
};

export type UpdateEventPayload = {
  payload: EventPayload;
  normalized: NormalizedRecurrence;
};

export const updateEventSchema: Schema<UpdateEventPayload> = {
  parse(input: unknown) {
    const validated = validateEventPayload(input);
    if ('error' in validated) {
      throw new ValidationError(validated.error as string);
    }
    return validated;
  },
};

export type SeriesTogglePayload = {
  series: boolean;
};

export const seriesToggleSchema: Schema<SeriesTogglePayload> = {
  parse(input: unknown) {
    const { series } = (input ?? {}) as Record<string, unknown>;
    if (series !== undefined && typeof series !== 'boolean') {
      throw new ValidationError('series must be a boolean');
    }
    return { series: Boolean(series) };
  },
};
