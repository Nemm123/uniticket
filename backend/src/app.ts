import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { NextFunction } from 'express';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { eventsRouter } from './routes/events.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
// Vite uses port 3000 in this project, while the backend default remains
// compatible with the standard 5173 dev port and CLIENT_ORIGIN override.
app.use(cors({
  origin: [
    env.clientOrigin,
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ],
}));
app.use(express.json({ limit: '1mb' }));

app.use('/api', healthRouter);
app.use('/api/events', eventsRouter);

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: NextFunction) => {
  if (error instanceof SyntaxError) {
    response.status(400).json({ error: 'Request body contains invalid JSON.' });
    return;
  }
  console.error('[UniTicket API] Unhandled error:', error);
  response.status(500).json({ error: 'Internal server error.' });
});
