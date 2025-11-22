"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const google_auth_library_1 = require("google-auth-library");
const env_1 = require("../config/env");
const userRepository_1 = require("../repositories/userRepository");
const jwt_1 = require("../utils/jwt");
const serializer_1 = require("../utils/serializer");
const router = (0, express_1.Router)();
const googleClient = env_1.GOOGLE_CLIENT_ID ? new google_auth_library_1.OAuth2Client(env_1.GOOGLE_CLIENT_ID) : null;
router.post('/signup', (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ error: 'email is required' });
    }
    if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'password must be at least 6 characters' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if ((0, userRepository_1.findUserByEmail)(normalizedEmail)) {
        return res.status(409).json({ error: 'email already registered' });
    }
    const passwordHash = bcryptjs_1.default.hashSync(password, 10);
    const user = (0, userRepository_1.createUser)(normalizedEmail, passwordHash, 'user');
    const token = (0, jwt_1.signToken)(user);
    res.status(201).json({ token, user: (0, serializer_1.toPublicUser)(user) });
});
router.post('/login', (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'email and password are required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = (0, userRepository_1.findUserByEmail)(normalizedEmail);
    if (!user) {
        return res.status(401).json({ error: 'invalid credentials' });
    }
    if (!bcryptjs_1.default.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'invalid credentials' });
    }
    const token = (0, jwt_1.signToken)(user);
    res.json({ token, user: (0, serializer_1.toPublicUser)(user) });
});
router.post('/oauth/google', async (req, res) => {
    if (!googleClient || !env_1.GOOGLE_CLIENT_ID) {
        return res.status(500).json({ error: 'Google OAuth is not configured' });
    }
    const { idToken } = req.body ?? {};
    if (typeof idToken !== 'string' || !idToken.trim()) {
        return res.status(400).json({ error: 'idToken is required' });
    }
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: env_1.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload?.email || payload.email_verified === false) {
            return res.status(401).json({ error: 'Google account not verified' });
        }
        const normalizedEmail = payload.email.toLowerCase();
        let user = (0, userRepository_1.findUserByEmail)(normalizedEmail);
        if (!user) {
            const randomSecret = crypto_1.default.randomBytes(32).toString('hex');
            const passwordHash = bcryptjs_1.default.hashSync(randomSecret, 10);
            user = (0, userRepository_1.createUser)(normalizedEmail, passwordHash, 'user');
        }
        const token = (0, jwt_1.signToken)(user);
        res.json({ token, user: (0, serializer_1.toPublicUser)(user) });
    }
    catch (err) {
        return res.status(401).json({ error: 'Invalid Google token' });
    }
});
exports.default = router;
