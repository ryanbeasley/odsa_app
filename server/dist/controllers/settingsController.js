"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const env_1 = require("../config/env");
const authenticate_1 = require("../middleware/authenticate");
const pushSubscriptionRepository_1 = require("../repositories/pushSubscriptionRepository");
const webPushRepository_1 = require("../repositories/webPushRepository");
const userRepository_1 = require("../repositories/userRepository");
const serializer_1 = require("../utils/serializer");
const jwt_1 = require("../utils/jwt");
const router = (0, express_1.Router)();
router.patch('/profile', authenticate_1.authenticate, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { firstName, lastName, phone, email } = req.body ?? {};
    const updates = {};
    if (firstName !== undefined) {
        if (firstName !== null && typeof firstName !== 'string') {
            return res.status(400).json({ error: 'firstName must be a string' });
        }
        updates.first_name = firstName?.trim() ? firstName.trim() : null;
    }
    if (lastName !== undefined) {
        if (lastName !== null && typeof lastName !== 'string') {
            return res.status(400).json({ error: 'lastName must be a string' });
        }
        updates.last_name = lastName?.trim() ? lastName.trim() : null;
    }
    if (phone !== undefined) {
        if (phone !== null && typeof phone !== 'string') {
            return res.status(400).json({ error: 'phone must be a string' });
        }
        updates.phone = phone?.trim() ? phone.trim() : null;
    }
    if (email !== undefined) {
        if (email !== null && typeof email !== 'string') {
            return res.status(400).json({ error: 'email must be a string' });
        }
        const normalizedEmail = email?.trim().toLowerCase() ?? null;
        if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({ error: 'email is invalid' });
        }
        if (normalizedEmail && normalizedEmail !== req.user.email && (0, userRepository_1.findUserByEmail)(normalizedEmail)) {
            return res.status(409).json({ error: 'email already registered' });
        }
        if (normalizedEmail) {
            updates.email = normalizedEmail;
        }
    }
    const updated = (0, userRepository_1.updateUserProfile)(req.user.id, updates);
    if (!updated) {
        return res.status(404).json({ error: 'User not found' });
    }
    const token = (0, jwt_1.signToken)(updated);
    return res.json({ token, user: (0, serializer_1.toPublicUser)(updated) });
});
router.post('/push-subscriptions', authenticate_1.authenticate, (req, res) => {
    const { token, announcementAlertsEnabled, eventAlertsEnabled } = req.body ?? {};
    if (typeof token !== 'string' || !token.trim()) {
        return res.status(400).json({ error: 'token is required' });
    }
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const subscription = (0, pushSubscriptionRepository_1.upsertPushSubscription)(req.user.id, token.trim(), {
        announcementAlertsEnabled: typeof announcementAlertsEnabled === 'boolean' ? announcementAlertsEnabled : undefined,
        eventAlertsEnabled: typeof eventAlertsEnabled === 'boolean' ? eventAlertsEnabled : undefined,
    });
    return res.status(201).json({ subscription: (0, serializer_1.serializePushSubscription)(subscription) });
});
router.get('/push-subscriptions', authenticate_1.authenticate, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const existing = (0, pushSubscriptionRepository_1.findPushSubscriptionByUserId)(req.user.id);
    return res.json({ subscription: existing ? (0, serializer_1.serializePushSubscription)(existing) : null });
});
router.delete('/push-subscriptions', authenticate_1.authenticate, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    (0, pushSubscriptionRepository_1.deletePushSubscription)(req.user.id);
    return res.status(204).send();
});
router.post('/web-push-subscriptions', authenticate_1.authenticate, (req, res) => {
    const { endpoint, keys } = req.body ?? {};
    if (typeof endpoint !== 'string' || !endpoint.trim()) {
        return res.status(400).json({ error: 'endpoint is required' });
    }
    if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') {
        return res.status(400).json({ error: 'keys.p256dh and keys.auth are required' });
    }
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const subscription = (0, webPushRepository_1.upsertWebPushSubscription)(req.user.id, endpoint.trim(), keys.p256dh, keys.auth);
    return res.status(201).json({ subscription: (0, serializer_1.serializeWebPushSubscription)(subscription) });
});
router.get('/web-push-subscriptions', authenticate_1.authenticate, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id: userId } = req.user;
    const subscriptions = (0, webPushRepository_1.listWebPushSubscriptions)()
        .filter((row) => row.user_id === userId)
        .map(serializer_1.serializeWebPushSubscription);
    return res.json({ subscriptions });
});
router.delete('/web-push-subscriptions', authenticate_1.authenticate, (req, res) => {
    const { endpoint } = req.body ?? {};
    if (typeof endpoint !== 'string' || !endpoint.trim()) {
        return res.status(400).json({ error: 'endpoint is required' });
    }
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const existing = (0, webPushRepository_1.findWebPushSubscriptionByEndpoint)(endpoint.trim());
    if (!existing || existing.user_id !== req.user.id) {
        return res.status(404).json({ error: 'Subscription not found' });
    }
    (0, webPushRepository_1.deleteWebPushSubscription)(endpoint.trim());
    return res.status(204).send();
});
router.get('/web-push/public-key', (_req, res) => {
    if (!env_1.VAPID_PUBLIC_KEY) {
        return res.status(404).json({ error: 'Web push not configured' });
    }
    return res.json({ publicKey: env_1.VAPID_PUBLIC_KEY });
});
router.get('/users', authenticate_1.authenticate, authenticate_1.requireAdmin, (req, res) => {
    const queryParam = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
    const users = (0, userRepository_1.listUsers)(typeof queryParam === 'string' ? queryParam : undefined).map(serializer_1.toPublicUser);
    return res.json({ users });
});
router.patch('/users/:id/role', authenticate_1.authenticate, authenticate_1.requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid user id' });
    }
    if (req.user?.id === id) {
        return res.status(400).json({ error: 'You cannot change your own role' });
    }
    const { role } = req.body ?? {};
    if (role !== 'user' && role !== 'admin') {
        return res.status(400).json({ error: 'role must be user or admin' });
    }
    const updated = (0, userRepository_1.updateUserRole)(id, role);
    if (!updated) {
        return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user: (0, serializer_1.toPublicUser)(updated) });
});
exports.default = router;
