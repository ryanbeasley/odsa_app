import { Router } from 'express';
import { authenticate, AuthedRequest, requireAdmin } from '../middleware/authenticate';
import { createAnnouncement, listAnnouncements } from '../repositories/announcementRepository';
import {
  createSupportLink,
  deleteSupportLink,
  listSupportLinks,
  reorderSupportLinks,
  updateSupportLink,
} from '../repositories/supportLinkRepository';
import { serializeAnnouncement, serializeSupportLink } from '../utils/serializer';
import { sendAnnouncementPush } from '../services/pushService';

const router = Router();

/**
 * Parses pagination limits from query params while enforcing bounds.
 */
function parseLimit(value: unknown, fallback = 5) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(20, Math.max(1, Math.floor(parsed)));
}

/**
 * Returns paginated announcements for authenticated users.
 */
router.get('/announcements', authenticate, (req, res) => {
  const limit = parseLimit(req.query.limit);
  const cursorParam = Array.isArray(req.query.cursor) ? req.query.cursor[0] : req.query.cursor;
  const cursor = cursorParam ? Number(cursorParam) : undefined;
  if (cursorParam && (!cursor || cursor <= 0)) {
    return res.status(400).json({ error: 'cursor must be a positive number' });
  }

  const rows = listAnnouncements(limit, cursor);
  const announcements = rows.map(serializeAnnouncement);
  const nextCursor = rows.length === limit ? rows.at(-1)?.id : null;
  console.log(`Fetched ${rows.length} announcements (limit: ${limit}, cursor: ${cursor ?? 'none'})`);
  res.json({ announcements, nextCursor });
});

/**
 * Allows admins to create a new announcement.
 */
router.post('/announcements', authenticate, requireAdmin, (req: AuthedRequest, res) => {
  const { message } = req.body ?? {};
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message must be a non-empty string' });
  }
  const announcement = createAnnouncement(message.trim());
  void sendAnnouncementPush(announcement.body);
  res.status(201).json({ announcement: serializeAnnouncement(announcement) });
});

/**
 * Lists all support links.
 */
router.get('/support-links', authenticate, (_req, res) => {
  const links = listSupportLinks().map(serializeSupportLink);
  res.json({ links });
});

/**
 * Creates a new support link (admin only).
 */
router.post('/support-links', authenticate, requireAdmin, (req, res) => {
  const error = validateSupportLinkBody(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const { title, description, link } = req.body as {
    title: string;
    description: string;
    link: string;
  };

  const created = createSupportLink(title.trim(), description.trim(), link.trim());
  return res.status(201).json({ link: serializeSupportLink(created) });
});

/**
 * Persists a new ordering for support links (admin only).
 */
router.patch('/support-links/reorder', authenticate, requireAdmin, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  if (!ids?.length || !ids.every((value: unknown) => Number.isFinite(Number(value)))) {
    return res.status(400).json({ error: 'ids must be an array of numbers' });
  }
  const parsedIds = ids.map(Number);
  const uniqueIds = new Set(parsedIds);
  if (uniqueIds.size !== parsedIds.length) {
    return res.status(400).json({ error: 'ids must be unique' });
  }

  const existingIds: number[] = listSupportLinks().map((item) => item.id);
  const missingIds = parsedIds.filter((id: number) => !existingIds.includes(id));
  if (missingIds.length) {
    return res.status(400).json({ error: 'ids must match existing support links' });
  }

  const fullOrder = [...parsedIds, ...existingIds.filter((id: number) => !parsedIds.includes(id))];
  const links = reorderSupportLinks(fullOrder).map(serializeSupportLink);
  return res.json({ links });
});

/**
 * Updates an existing support link (admin only).
 */
router.patch('/support-links/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' });
  }

  const error = validateSupportLinkBody(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const { title, description, link } = req.body as {
    title: string;
    description: string;
    link: string;
  };

  const updated = updateSupportLink(id, title.trim(), description.trim(), link.trim());
  if (!updated) {
    return res.status(404).json({ error: 'Support link not found' });
  }
  return res.json({ link: serializeSupportLink(updated) });
});

/**
 * Deletes a support link by ID (admin only).
 */
router.delete('/support-links/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive number' });
  }
  deleteSupportLink(id);
  return res.status(204).send();
});

/**
 * Validates the payload for creating/updating support links.
 */
function validateSupportLinkBody(body: unknown) {
  const { title, description, link } = (body ?? {}) as Record<string, unknown>;
  if (typeof title !== 'string' || !title.trim()) {
    return 'title is required';
  }
  if (typeof description !== 'string' || !description.trim()) {
    return 'description is required';
  }
  if (typeof link !== 'string' || !link.trim()) {
    return 'link is required';
  }
  return null;
}

export default router;
