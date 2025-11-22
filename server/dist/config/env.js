"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVENT_ALERT_HOUR_MS = exports.EVENT_ALERT_LOOKAHEAD_HOURS = exports.EVENT_ALERT_INTERVAL_MS = exports.VAPID_PRIVATE_KEY = exports.VAPID_PUBLIC_KEY = exports.EXPO_PUSH_TOKEN = exports.GOOGLE_CLIENT_ID = exports.TOKEN_EXPIRY = exports.JWT_SECRET = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';
exports.TOKEN_EXPIRY = process.env.JWT_EXPIRY ?? '7d';
exports.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
exports.EXPO_PUSH_TOKEN = process.env.EXPO_PUSH_ACCESS_TOKEN ?? '';
exports.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
exports.VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
exports.EVENT_ALERT_INTERVAL_MS = Number(process.env.EVENT_ALERT_INTERVAL_MS ?? 5 * 60 * 1000);
exports.EVENT_ALERT_LOOKAHEAD_HOURS = Number(process.env.EVENT_ALERT_LOOKAHEAD_HOURS ?? 24);
exports.EVENT_ALERT_HOUR_MS = 60 * 60 * 1000;
