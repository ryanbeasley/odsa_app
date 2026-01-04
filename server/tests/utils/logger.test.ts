import type { Request } from 'express';
import type fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initLogging } from '../../src/utils/logger';
import { getLogContext, isLogSilenced, LogLevel } from '../../src/utils/logContext';

vi.mock('../../src/utils/logContext', async () => {
  const actual = await vi.importActual<typeof import('../../src/utils/logContext')>('../../src/utils/logContext');
  return {
    ...actual,
    getLogContext: vi.fn(),
    isLogSilenced: vi.fn(),
  };
});

const mockedGetLogContext = vi.mocked(getLogContext);
const mockedIsLogSilenced = vi.mocked(isLogSilenced);

describe('logger', () => {
  const originals = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  beforeEach(() => {
    console.log = originals.log;
    console.info = originals.info;
    console.warn = originals.warn;
    console.error = originals.error;
    console.debug = originals.debug;
    mockedGetLogContext.mockReset();
    mockedIsLogSilenced.mockReset();
  });

  afterEach(() => {
    console.log = originals.log;
    console.info = originals.info;
    console.warn = originals.warn;
    console.error = originals.error;
    console.debug = originals.debug;
  });

  it('writes to the log stream and forwards console output', () => {
    const logStream = { write: vi.fn() } as unknown as fs.WriteStream;
    mockedIsLogSilenced.mockReturnValue(false);
    mockedGetLogContext.mockReturnValue({
      userId: 'user-1',
      sessionId: 'session-1',
      logStream,
      logLevel: LogLevel.INFO,
    });

    const originalLog = vi.fn();
    console.log = originalLog;

    initLogging();
    console.log('hello', { extra: true });

    expect(originalLog).toHaveBeenCalledWith('hello', { extra: true });
    expect(mockedGetLogContext).toHaveBeenCalledWith(LogLevel.INFO);
    expect(logStream.write).toHaveBeenCalledTimes(1);
    expect(logStream.write).toHaveBeenCalledWith(expect.stringContaining('|info|user-1|session-1|'));
  });

  it('uses the expected log levels for console methods', () => {
    const logStream = { write: vi.fn() } as unknown as fs.WriteStream;
    mockedIsLogSilenced.mockReturnValue(false);
    mockedGetLogContext.mockReturnValue({
      userId: 'user-1',
      sessionId: 'session-1',
      logStream,
      logLevel: LogLevel.INFO,
    });

    console.error = vi.fn();
    console.warn = vi.fn();

    initLogging();
    console.warn('warn');
    console.error('error');

    expect(mockedGetLogContext).toHaveBeenCalledWith(LogLevel.WARN);
    expect(mockedGetLogContext).toHaveBeenCalledWith(LogLevel.ERROR);
  });

  it('no-ops when logging is silenced', () => {
    mockedIsLogSilenced.mockReturnValue(true);
    const originalLog = vi.fn();
    const originalError = vi.fn();
    console.log = originalLog;
    console.error = originalError;

    initLogging();
    console.log('quiet');
    console.error('quiet');

    expect(originalLog).not.toHaveBeenCalled();
    expect(originalError).not.toHaveBeenCalled();
    expect(mockedGetLogContext).not.toHaveBeenCalled();
  });

  it('adds console helpers when enabled', () => {
    const logStream = { write: vi.fn() } as unknown as fs.WriteStream;
    mockedIsLogSilenced.mockReturnValue(false);
    mockedGetLogContext.mockReturnValue({
      userId: 'user-1',
      sessionId: 'session-1',
      logStream,
      logLevel: LogLevel.INFO,
    });

    const originalLog = vi.fn();
    console.log = originalLog;

    initLogging();
    console.logEnter('payload');
    console.logRequest({
      method: 'GET',
      url: '/health',
      headers: { accept: 'application/json' },
    } as Request);

    expect(originalLog).toHaveBeenCalled();
  });
});
