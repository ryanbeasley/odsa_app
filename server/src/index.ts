import app from './app';
import { startEventAlertScheduler } from './services/pushService';

const port = Number(process.env.PORT ?? 4000);

app.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://0.0.0.0:${port}`);
  startEventAlertScheduler();
});
