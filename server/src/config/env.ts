import dotenv from 'dotenv';
dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';
export const TOKEN_EXPIRY = process.env.JWT_EXPIRY ?? '7d';
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
export const EXPO_PUSH_TOKEN = process.env.EXPO_PUSH_ACCESS_TOKEN ?? '';
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
export const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN ?? '';
export const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID ?? '';
export const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? '';
export const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? '';
export const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER ?? '';
// push notification automation checks every 5 minutes
export const EVENT_ALERT_INTERVAL_MS = Number(process.env.EVENT_ALERT_INTERVAL_MS ?? 5 * 60 * 1000);
// first check one day in advance
export const EVENT_ALERT_LOOKAHEAD_HOURS = Number(process.env.EVENT_ALERT_LOOKAHEAD_HOURS ?? 24);
// second check one hour in advance
export const EVENT_ALERT_HOUR_MS = 60 * 60 * 1000;
