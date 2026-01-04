import path from 'node:path';
import util from 'node:util';
import type { Request } from 'express';
import { getLogContext, isLogSilenced, LogLevel } from './logContext';

export function initLogging() {
  if (isLogSilenced()) {
    const noop = () => {};
    console.log = noop;
    console.info = noop;
    console.warn = noop;
    console.error = noop;
    console.debug = noop;
    console.logEnter = noop;
    console.logRequest = () => {};
    return;
  }
  const writeLine = (level: LogLevel, args: unknown[]) => {
    const context = getLogContext(level);
    if (!context) {
      return;
    }
    const normalizedArgs = args.map((arg) => normalizeLogArg(arg));
    const message = util.format(...normalizedArgs).replace(/[\r\n\t]+/g, ' ');
    const caller = getCallerName();
    context.logStream?.write(`${new Date().toISOString()}|${level}|${context.userId}|${context.sessionId}|${caller}|${message}\n`);
  };

  const original = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
  };

  console.log = (...args: unknown[]) => {
    original.log(...args);
    writeLine(LogLevel.INFO, args);
  };
  console.info = (...args: unknown[]) => {
    original.info(...args);
    writeLine(LogLevel.INFO, args);
  };
  console.warn = (...args: unknown[]) => {
    original.warn(...args);
    writeLine(LogLevel.WARN, args);
  };
  console.error = (...args: unknown[]) => {
    original.error(...args);
    writeLine(LogLevel.ERROR, args);
  };
  console.debug = (...args: unknown[]) => {
    original.debug(...args);
    writeLine(LogLevel.DEBUG, args);
  };

  console.logEnter = (...params: unknown[]) => {
    const caller = getCallerName();
    const serializedParams = params.map((param) => normalizeLogArg(param));
    console.log(`ENTER ${caller}`, ...serializedParams);
  };

  console.logRequest = (req: Request) => {
    const { method, url, headers, body } = req;
    console.log('REQUEST', {
      method: method,
      path: url,
      headers: Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value])
      ),
      body: body,
    });
  }
}

function getCallerName() {
  const stack = new Error().stack?.split('\n') ?? [];
  const candidate = stack.find((line) => !line.includes('logger.ts') && line.includes('at '));
  if (!candidate) {
    return 'unknown';
  }
  const match = candidate.match(/at\s+(?:(.+?)\s+\()?(.+):(\d+):(\d+)\)?/);
  if (!match) {
    return 'unknown';
  }
  const functionName = match[1] ? match[1].trim() : 'anonymous';
  const filename = path.basename(match[2]);
  const lineNumber = match[3];
  if (functionName === 'anonymous') {
    return `${filename}|${lineNumber}`;
  }
  return `${filename}:${functionName}|${lineNumber} `;
}

/**
 * Normalizes a log argument for consistent logging, minifies json args.
 */
function normalizeLogArg(arg: unknown) {
  if (typeof arg === 'string') {
    const trimmed = arg.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.stringify(JSON.parse(trimmed));
      } catch {
        return arg;
      }
    }
    return arg;
  }
  if (arg && typeof arg === 'object' && !(arg instanceof Error)) {
    try {
      return JSON.stringify(arg);
    } catch {
      return arg;
    }
  }
  return arg;
}
