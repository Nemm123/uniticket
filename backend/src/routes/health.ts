import { Router } from 'express';
import { checkDatabaseConnection } from '../db/pool.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_request, response) => {
  try {
    await checkDatabaseConnection();
    response.status(200).json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('[UniTicket Health] Database check failed:', error);
    response.status(503).json({ status: 'degraded', database: 'unavailable' });
  }
});
