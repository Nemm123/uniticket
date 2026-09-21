import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.port, () => {
  console.log(`[UniTicket API] Listening on http://localhost:${env.port}`);
});

const shutdown = (signal: string) => {
  console.log(`[UniTicket API] ${signal} received. Shutting down.`);
  server.close(() => process.exit(0));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
