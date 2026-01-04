import { AsyncLocalStorage } from 'async_hooks';
import fs from 'fs';
import path from 'path';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';

type LogContext = {
  userId: string;
  sessionId: string;
  logStream: fs.WriteStream | null;
  logLevel: LogLevel;
};

const storage = new AsyncLocalStorage<LogContext>();

export const DEFAULT_LOG_PATH = '/var/log/odsa_app_logs.txt';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

const LOG_LEVELS = new Set(Object.values(LogLevel));
const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

export function isLogSilenced() {
  const value = process.env.LOG_SILENT ?? '';
  return value === '1' || value.toLowerCase() === 'true';
}

export function runWithLogContext(context: LogContext, callback: () => void) {
  storage.run(context, callback);
}

export function getLogContext(level: LogLevel = LogLevel.INFO): LogContext | null {
  if (isLogSilenced()) {
    return null;
  }
  const context = storage.getStore();
  const logStream = context?.logStream ?? null;
  if (!context || !logStream || (level && !shouldLog(level))) {
    return null;
  }
  const userId = context.userId ?? '-';
  const sessionId = (context.sessionId ?? '-').replace('[', '').replace(']', '');
  const logLevel = context.logLevel;
  return { userId, sessionId, logStream, logLevel };
}

export function buildLogContext(
  userId: string,
  sessionId: string,
  logPath: string | null = null,
  logLevel: string
): LogContext | null {
  if (isLogSilenced()) {
    return null;
  }
  const logStream = initLogStream(logPath ?? DEFAULT_LOG_PATH) ?? null;
  const typedLogLevel = parseLogLevel(logLevel);
  return { userId, sessionId, logStream, logLevel: typedLogLevel };
}

export function buildLogContextFromRequest(
  request: Request,
  logPath: string | null = null,
  logLevel: string = 'info'
): LogContext | null {
  if (isLogSilenced()) {
    return null;
  }
  const typedLogLevel = parseLogLevel(logLevel);
  const logStream = initLogStream(logPath ?? DEFAULT_LOG_PATH) ?? null;
  const sessionHeader = request.get('x-session-id') ?? request.get('x-request-id');
  const sessionId = sessionHeader ?? hashRequest(request);
  const authHeader = request.get('authorization');
  const userId = extractUserId(authHeader) ?? request.get('x-user-id') ?? 'system';
  return { userId, sessionId, logStream, logLevel: typedLogLevel };
}

function parseLogLevel(value?: string): LogLevel {
  const normalized = value?.toLowerCase() ?? '';
  if (LOG_LEVELS.has(normalized as LogLevel)) {
    return normalized as LogLevel;
  }
  return LogLevel.INFO;
}

function shouldLog(level: LogLevel): boolean {
  const context = storage.getStore();
  if (!context) {
    return false;
  }
  return LOG_LEVEL_SEVERITY[level] >= LOG_LEVEL_SEVERITY[context.logLevel];
}

function initLogStream(logPath: string) {
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    return fs.createWriteStream(logPath, { flags: 'a' });
  } catch {
    console.warn('[logger] Failed to open log file', { logPath });
  }
}

function extractUserId(authHeader?: string | string[]) {
  if (!authHeader || Array.isArray(authHeader)) {
    return null;
  }
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length);
  const decoded = jwt.decode(token) as jwt.JwtPayload | null;
  const sub = decoded?.sub;
  return typeof sub === 'string' ? sub : null;
}

function hashRequest(request: Request) {
  const payload = JSON.stringify({
    method: request.method,
    url: request.originalUrl ?? request.url,
    headers: request.headers,
    ip: request.ip,
  });
  let hash = 5381;
  for (let i = 0; i < payload.length; i += 1) {
    hash = (hash * 33) ^ payload.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}
