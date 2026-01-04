import { ValidationError } from '../middleware/validate';
import { Schema } from './types';

const parseId = (req: unknown) => {
  const rawId = (req as { params?: Record<string, string> } | undefined)?.params?.id;
  const id = Number(rawId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new ValidationError('id must be a positive number');
  }
  return id;
};

export type SupportLinkIdPayload = {
  id: number;
};

export const supportLinkIdSchema: Schema<SupportLinkIdPayload> = {
  parse(_input: unknown, req?: unknown) {
    return { id: parseId(req) };
  },
};

export type AnnouncementQueryPayload = {
  limit: number;
  cursor?: number;
};

export const announcementQuerySchema: Schema<AnnouncementQueryPayload> = {
  parse(input: unknown) {
    const query = input as Record<string, unknown>;
    const limitRaw = query.limit;
    const limitParsed = Number(limitRaw);
    const limit = Number.isFinite(limitParsed) && limitParsed > 0 ? Math.min(20, Math.floor(limitParsed)) : 5;
    const cursorParam = Array.isArray(query.cursor) ? query.cursor[0] : query.cursor;
    if (cursorParam !== undefined && cursorParam !== null && cursorParam !== '') {
      const cursor = Number(cursorParam);
      if (!Number.isFinite(cursor) || cursor <= 0) {
        throw new ValidationError('cursor must be a positive number');
      }
      return { limit, cursor };
    }
    return { limit };
  },
};
