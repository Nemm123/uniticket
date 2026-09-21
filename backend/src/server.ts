import { app } from './app.js';
import { env } from './config/env.js';
import { runMigrations } from './db/migrate.js';

let server: ReturnType<typeof app.listen>;

async function start() {
  try {
    console.log('[UniTicket API] Checking and running database migrations...');
    await runMigrations();
  } catch (error) {
    console.error('[UniTicket API] Migration warning:', error);
  }

  server = app.listen(env.port, () => {
    console.log(`[UniTicket API] Listening on http://localhost:${env.port}`);
  });
}

const shutdown = (signal: string) => {
  console.log(`[UniTicket API] ${signal} received. Shutting down.`);
  if (server) {
    server.close(() => process.exit(0));
  } else {
    process.exit(0);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

void start();
