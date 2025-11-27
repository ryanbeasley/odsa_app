import express from 'express';
import { EXPO_PUSH_TOKEN } from './config/env';
import authController from './controllers/authController';
import homeController from './controllers/homeController';
import eventsController from './controllers/eventsController';
import settingsController from './controllers/settingsController';
import { startEventAlertScheduler } from './services/pushService';

const app = express();

app.use(express.json());

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

app.use('/api', authController);
app.use('/api', homeController);
app.use('/api', eventsController);
app.use('/api', settingsController);

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
  startEventAlertScheduler();
});
