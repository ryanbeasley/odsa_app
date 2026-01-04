import { ValidationError } from '../middleware/validate';
import { Schema } from './types';

const parseUserId = (req: unknown) => {
  const rawId = (req as { params?: Record<string, string> } | undefined)?.params?.id;
  const id = Number(rawId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new ValidationError('id must be a positive number');
  }
  return id;
};

export type UserIdParamPayload = {
  id: number;
};

export const userIdParamSchema: Schema<UserIdParamPayload> = {
  parse(_input: unknown, req?: unknown) {
    return { id: parseUserId(req) };
  },
};

export type UserListQueryPayload = {
  q?: string;
};

export const userListQuerySchema: Schema<UserListQueryPayload> = {
  parse(input: unknown) {
    const query = input as Record<string, unknown>;
    const qParam = Array.isArray(query.q) ? query.q[0] : query.q;
    if (qParam === undefined || qParam === null || qParam === '') {
      return {};
    }
    if (typeof qParam !== 'string') {
      throw new ValidationError('q must be a string');
    }
    return { q: qParam.trim() };
  },
};
