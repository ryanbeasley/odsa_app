"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authenticate_1 = require("../middleware/authenticate");
const announcementRepository_1 = require("../repositories/announcementRepository");
const supportLinkRepository_1 = require("../repositories/supportLinkRepository");
const serializer_1 = require("../utils/serializer");
const pushService_1 = require("../services/pushService");
const router = (0, express_1.Router)();
function parseLimit(value, fallback = 5) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return Math.min(20, Math.max(1, Math.floor(parsed)));
}
router.get('/announcements', authenticate_1.authenticate, (req, res) => {
    const limit = parseLimit(req.query.limit);
    const cursorParam = Array.isArray(req.query.cursor) ? req.query.cursor[0] : req.query.cursor;
    const cursor = cursorParam ? Number(cursorParam) : undefined;
    if (cursorParam && (!cursor || cursor <= 0)) {
        return res.status(400).json({ error: 'cursor must be a positive number' });
    }
    const rows = (0, announcementRepository_1.listAnnouncements)(limit, cursor);
    const announcements = rows.map(serializer_1.serializeAnnouncement);
    const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;
    res.json({ announcements, nextCursor });
});
router.post('/announcements', authenticate_1.authenticate, authenticate_1.requireAdmin, (req, res) => {
    const { message } = req.body ?? {};
    if (typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'message must be a non-empty string' });
    }
    const announcement = (0, announcementRepository_1.createAnnouncement)(message.trim());
    void (0, pushService_1.sendAnnouncementPush)(announcement.body);
    res.status(201).json({ announcement: (0, serializer_1.serializeAnnouncement)(announcement) });
});
router.get('/hello', authenticate_1.authenticate, (req, res) => {
    const rows = (0, announcementRepository_1.listAnnouncements)(5);
    res.json({ announcements: rows.map(serializer_1.serializeAnnouncement), nextCursor: null });
});
router.post('/hello', authenticate_1.authenticate, authenticate_1.requireAdmin, (req, res) => {
    const { message } = req.body ?? {};
    if (typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'message must be a non-empty string' });
    }
    const announcement = (0, announcementRepository_1.createAnnouncement)(message.trim());
    void (0, pushService_1.sendAnnouncementPush)(announcement.body);
    res.status(201).json({ announcement: (0, serializer_1.serializeAnnouncement)(announcement) });
});
router.get('/support-links', authenticate_1.authenticate, (_req, res) => {
    const links = (0, supportLinkRepository_1.listSupportLinks)().map(serializer_1.serializeSupportLink);
    res.json({ links });
});
router.post('/support-links', authenticate_1.authenticate, authenticate_1.requireAdmin, (req, res) => {
    const error = validateSupportLinkBody(req.body);
    if (error) {
        return res.status(400).json({ error });
    }
    const { title, description, link } = req.body;
    const created = (0, supportLinkRepository_1.createSupportLink)(title.trim(), description.trim(), link.trim());
    return res.status(201).json({ link: (0, serializer_1.serializeSupportLink)(created) });
});
router.patch('/support-links/reorder', authenticate_1.authenticate, authenticate_1.requireAdmin, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
    if (!ids?.length || !ids.every((value) => Number.isFinite(Number(value)))) {
        return res.status(400).json({ error: 'ids must be an array of numbers' });
    }
    const parsedIds = ids.map((value) => Number(value));
    const uniqueIds = new Set(parsedIds);
    if (uniqueIds.size !== parsedIds.length) {
        return res.status(400).json({ error: 'ids must be unique' });
    }
    const existingIds = (0, supportLinkRepository_1.listSupportLinks)().map((item) => item.id);
    const missingIds = parsedIds.filter((id) => !existingIds.includes(id));
    if (missingIds.length) {
        return res.status(400).json({ error: 'ids must match existing support links' });
    }
    const fullOrder = [...parsedIds, ...existingIds.filter((id) => !parsedIds.includes(id))];
    const links = (0, supportLinkRepository_1.reorderSupportLinks)(fullOrder).map(serializer_1.serializeSupportLink);
    return res.json({ links });
});
router.patch('/support-links/:id', authenticate_1.authenticate, authenticate_1.requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'id must be a positive number' });
    }
    const error = validateSupportLinkBody(req.body);
    if (error) {
        return res.status(400).json({ error });
    }
    const { title, description, link } = req.body;
    const updated = (0, supportLinkRepository_1.updateSupportLink)(id, title.trim(), description.trim(), link.trim());
    if (!updated) {
        return res.status(404).json({ error: 'Support link not found' });
    }
    return res.json({ link: (0, serializer_1.serializeSupportLink)(updated) });
});
router.delete('/support-links/:id', authenticate_1.authenticate, authenticate_1.requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'id must be a positive number' });
    }
    (0, supportLinkRepository_1.deleteSupportLink)(id);
    return res.status(204).send();
});
function validateSupportLinkBody(body) {
    const { title, description, link } = (body ?? {});
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
exports.default = router;
