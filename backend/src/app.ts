import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { NextFunction } from 'express';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { eventsRouter } from './routes/events.js';
import { ticketsRouter } from './routes/tickets.js';
import { authRouter } from './routes/auth.js';
import { ordersRouter } from './routes/orders.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());

const allowedExactOrigins = new Set([
  env.clientOrigin,
  'https://uniticket-ud18.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
]);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests without Origin (e.g. curl, postman, server-to-server)
    if (!origin) return callback(null, true);
    // Browser clients must be explicitly configured; do not trust arbitrary Vercel projects.
    if (allowedExactOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/events', eventsRouter);
app.use('/api/tickets', ticketsRouter);

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
