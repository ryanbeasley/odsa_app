import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Request } from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildLogContext,
  buildLogContextFromRequest,
  getLogContext,
  isLogSilenced,
  LogLevel,
  runWithLogContext,
} from '../src/utils/logContext';

type TempLog = {
  dir: string;
  logPath: string;
};

function makeTempLog(): TempLog {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'odsa-log-'));
  return { dir, logPath: path.join(dir, 'app.log') };
}

function cleanupTempLog(temp: TempLog) {
  fs.rmSync(temp.dir, { recursive: true, force: true });
}

function makeRequest(headers: Record<string, string>): Request {
  const normalized: Record<string, string> = {};
  Object.entries(headers).forEach(([key, value]) => {
    normalized[key.toLowerCase()] = value;
  });
  return {
    method: 'GET',
    originalUrl: '/test',
    url: '/test',
    headers: normalized,
    ip: '127.0.0.1',
    get(name: string) {
      return normalized[name.toLowerCase()];
    },
  } as Request;
}

async function closeLogStream(context: ReturnType<typeof buildLogContext>) {
  if (!context?.logStream) {
    return;
  }
  await new Promise<void>((resolve) => {
    context.logStream?.end(() => resolve());
  });
}

describe('logContext', () => {
  const originalLogSilent = process.env.LOG_SILENT;

  beforeEach(() => {
    delete process.env.LOG_SILENT;
  });

  afterEach(() => {
    if (originalLogSilent === undefined) {
      delete process.env.LOG_SILENT;
    } else {
      process.env.LOG_SILENT = originalLogSilent;
    }
  });

  it('detects when logging is silenced', () => {
    process.env.LOG_SILENT = '1';
    expect(isLogSilenced()).toBe(true);
    process.env.LOG_SILENT = 'true';
    expect(isLogSilenced()).toBe(true);
    process.env.LOG_SILENT = 'false';
    expect(isLogSilenced()).toBe(false);
  });

  it('buildLogContext returns null when silenced', () => {
    const temp = makeTempLog();
    process.env.LOG_SILENT = '1';
    const context = buildLogContext('user', 'session', temp.logPath, 'info');
    expect(context).toBeNull();
    cleanupTempLog(temp);
  });

  it('buildLogContextFromRequest uses request headers', async () => {
    const temp = makeTempLog();
    const req = makeRequest({
      'x-session-id': 'session-123',
      'x-user-id': 'user-456',
    });
    const context = buildLogContextFromRequest(req, temp.logPath, 'info');
    expect(context?.sessionId).toBe('session-123');
    expect(context?.userId).toBe('user-456');
    expect(context?.logLevel).toBe(LogLevel.INFO);
    await closeLogStream(context);
    cleanupTempLog(temp);
  });

  it('getLogContext respects log level filtering', async () => {
    const temp = makeTempLog();
    const context = buildLogContext('user-1', 'session-1', temp.logPath, 'info');
    if (!context) {
      throw new Error('Expected log context to be created');
    }
    runWithLogContext(context, () => {
      expect(getLogContext(LogLevel.INFO)?.userId).toBe('user-1');
      expect(getLogContext(LogLevel.DEBUG)).toBeNull();
      expect(getLogContext(LogLevel.ERROR)?.sessionId).toBe('session-1');
    });
    await closeLogStream(context);
    cleanupTempLog(temp);
  });

  it('getLogContext returns null when silenced', async () => {
    const temp = makeTempLog();
    const context = buildLogContext('user-1', 'session-1', temp.logPath, 'info');
    if (!context) {
      throw new Error('Expected log context to be created');
    }
    process.env.LOG_SILENT = '1';
    runWithLogContext(context, () => {
      expect(getLogContext(LogLevel.INFO)).toBeNull();
    });
    await closeLogStream(context);
    cleanupTempLog(temp);
  });
});
