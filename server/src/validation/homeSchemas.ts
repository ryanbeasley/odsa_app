import { ValidationError } from '../middleware/validate';
import { listSupportLinks } from '../repositories/supportLinkRepository';
import { Schema } from './types';

export type AnnouncementPayload = {
  message: string;
  tags?: string[];
};

export const announcementSchema: Schema<AnnouncementPayload> = {
  parse(input: unknown) {
    const { message, tags } = (input ?? {}) as Record<string, unknown>;
    if (typeof message !== 'string' || !message.trim()) {
      throw new ValidationError('message must be a non-empty string');
    }
    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        throw new ValidationError('tags must be an array of strings');
      }
      const invalid = tags.some((tag) => typeof tag !== 'string' || !tag.trim());
      if (invalid) {
        throw new ValidationError('tags must be non-empty strings');
      }
    }
    const normalizedTags =
      tags && Array.isArray(tags)
        ? Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)))
        : undefined;
    return { message: message.trim(), tags: normalizedTags };
  },
};

export type SupportLinkPayload = {
  title: string;
  description: string;
  link: string;
};

export const supportLinkSchema: Schema<SupportLinkPayload> = {
  parse(input: unknown) {
    const { title, description, link } = (input ?? {}) as Record<string, unknown>;
    if (typeof title !== 'string' || !title.trim()) {
      throw new ValidationError('title is required');
    }
    if (typeof description !== 'string' || !description.trim()) {
      throw new ValidationError('description is required');
    }
    if (typeof link !== 'string' || !link.trim()) {
      throw new ValidationError('link is required');
    }
    return { title: title.trim(), description: description.trim(), link: link.trim() };
  },
};

export type SupportLinkReorderPayload = {
  ids: number[];
};

export const supportLinkReorderSchema: Schema<SupportLinkReorderPayload> = {
  parse(input: unknown) {
    const ids = Array.isArray((input as { ids?: unknown }).ids) ? (input as { ids: unknown[] }).ids : null;
    if (!ids?.length || !ids.every((value) => Number.isFinite(Number(value)))) {
      throw new ValidationError('ids must be an array of numbers');
    }
    const parsedIds = ids.map(Number);
    const uniqueIds = new Set(parsedIds);
    if (uniqueIds.size !== parsedIds.length) {
      throw new ValidationError('ids must be unique');
    }
    const existingIds = listSupportLinks().map((item) => item.id);
    const missingIds = parsedIds.filter((id) => !existingIds.includes(id));
    if (missingIds.length) {
      throw new ValidationError('ids must match existing support links');
    }
    return { ids: parsedIds };
  },
};
