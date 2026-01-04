import express from 'express';
import { EXPO_PUSH_TOKEN } from './config/env';
import authController from './controllers/authController';
import homeController from './controllers/homeController';
import eventsController from './controllers/eventsController';
import settingsController from './controllers/settingsController';
import { buildLogContextFromRequest, DEFAULT_LOG_PATH, isLogSilenced, runWithLogContext } from './utils/logContext';
import { initLogging } from './utils/logger';

type AppOptions = {
  disableLogContext?: boolean;
};

export function createApp(options: AppOptions = {}) {
  const logPath = process.env.LOG_FILE_PATH ?? DEFAULT_LOG_PATH;
  const logSilenced = isLogSilenced();
  initLogging();

  const app = express();

  app.use(express.json());

  /**
   * Log context middleware
   */
  app.use((req, _res, next) => {
    if (options.disableLogContext || logSilenced) {
      return next();
    }
    const context = buildLogContextFromRequest(
      req,
      logPath,
      process.env.LOG_LEVEL ?? 'info'
    );
    if (context === null) {
      return next();
    }
    return runWithLogContext(context, () => next());
  });

  /**
   * Request logging middleware
   */
  if (!logSilenced) {
    app.use((req, _res, next) => {
      console.logRequest(req);
      next();
    });
  }

  /**
   * Basic CORS middleware allowing configurable origins/methods/headers.
   */
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  /**
   * Health check endpoint that also reports push configuration status.
   */
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', pushConfigured: Boolean(EXPO_PUSH_TOKEN) });
  });

  /**
   * API routing to api controllers
   */
  app.use('/api', authController);
  app.use('/api', homeController);
  app.use('/api', eventsController);
  app.use('/api', settingsController);

  /**
   * Global error handler
   */
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

const app = createApp();

export default app;
