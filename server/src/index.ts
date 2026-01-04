import app from './app';
import { startEventAlertScheduler } from './services/pushService';

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
  startEventAlertScheduler();
});
