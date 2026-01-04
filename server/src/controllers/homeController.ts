import { RequestHandler } from 'express';
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
import { AnnouncementPayload, SupportLinkPayload, SupportLinkReorderPayload } from '../validation/homeSchemas';
import { AnnouncementQueryPayload, SupportLinkIdPayload } from '../validation/homeParamsSchemas';

/**
 * Returns paginated announcements for authenticated users.
 */
export const getAnnouncements: RequestHandler = (req, res) => {
  const { limit, cursor } = req.validatedQuery as AnnouncementQueryPayload;
  const rows = listAnnouncements(limit, cursor);
  const announcements = rows.map(serializeAnnouncement);
  const nextCursor = rows.length === limit ? rows.at(-1)?.id : null;
  console.log(`Fetched ${rows.length} announcements (limit: ${limit}, cursor: ${cursor ?? 'none'})`);
  return res.json({ announcements, nextCursor });
};

/**
 * Allows admins to create a new announcement.
 */
export const createAnnouncementHandler: RequestHandler = (req, res) => {
  const { message } = req.validated as AnnouncementPayload;
  const announcement = createAnnouncement(message);
  void sendAnnouncementPush(announcement.body);
  return res.status(201).json({ announcement: serializeAnnouncement(announcement) });
};

/**
 * Lists all support links.
 */
export const listSupportLinksHandler: RequestHandler = (_req, res) => {
  const links = listSupportLinks().map(serializeSupportLink);
  return res.json({ links });
};

/**
 * Creates a new support link (admin only).
 */
export const createSupportLinkHandler: RequestHandler = (req, res) => {
  const { title, description, link } = req.validated as SupportLinkPayload;
  const created = createSupportLink(title, description, link);
  return res.status(201).json({ link: serializeSupportLink(created) });
};

/**
 * Persists a new ordering for support links (admin only).
 */
export const reorderSupportLinksHandler: RequestHandler = (req, res) => {
  const { ids } = req.validated as SupportLinkReorderPayload;
  const existingIds: number[] = listSupportLinks().map((item) => item.id);
  const fullOrder = [...ids, ...existingIds.filter((id: number) => !ids.includes(id))];
  const links = reorderSupportLinks(fullOrder).map(serializeSupportLink);
  return res.json({ links });
};

/**
 * Updates an existing support link (admin only).
 */
export const updateSupportLinkHandler: RequestHandler = (req, res) => {
  const { id } = req.validatedQuery as SupportLinkIdPayload;
  const { title, description, link } = req.validated as SupportLinkPayload;
  const updated = updateSupportLink(id, title, description, link);
  if (!updated) {
    return res.status(404).json({ error: 'Support link not found' });
  }
  return res.json({ link: serializeSupportLink(updated) });
};

/**
 * Deletes a support link by ID (admin only).
 */
export const deleteSupportLinkHandler: RequestHandler = (req, res) => {
  const { id } = req.validatedQuery as SupportLinkIdPayload;
  deleteSupportLink(id);
  return res.status(204).send();
};
