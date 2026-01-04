import { ValidationError } from '../middleware/validate';
import { Schema } from './types';

const parseWorkingGroupId = (req: unknown) => {
  const idParam = (req as { params?: Record<string, string> } | undefined)?.params?.id;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) {
    throw new ValidationError('id must be a positive number');
  }
  return id;
};

export type WorkingGroupIdPayload = {
  id: number;
};

export const workingGroupIdSchema: Schema<WorkingGroupIdPayload> = {
  parse(_input: unknown, req?: unknown) {
    return { id: parseWorkingGroupId(req) };
  },
};
