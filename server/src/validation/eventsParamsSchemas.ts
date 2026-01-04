import { ValidationError } from '../middleware/validate';
import { Schema } from './types';

const parseEventId = (req: unknown) => {
  const rawId = (req as { params?: Record<string, string> } | undefined)?.params?.id;
  const id = Number(rawId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new ValidationError('id must be a positive number');
  }
  return id;
};

export type EventIdPayload = {
  id: number;
};

export const eventIdSchema: Schema<EventIdPayload> = {
  parse(_input: unknown, req?: unknown) {
    return { id: parseEventId(req) };
  },
};
