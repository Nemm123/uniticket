import { Router, type Request, type Response } from 'express';
import { checkSolanaHealth } from '../services/solana/health.js';

export const solanaHealthRouter = Router();

/**
 * GET /api/solana/health
 * Public health endpoint for Solana Devnet connection status, slot height, and minter balance.
 * Strictly read-only; never exposes private keys or secret material.
 */
solanaHealthRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = await checkSolanaHealth();
    const httpStatus = health.status === 'ok' ? 200 : 503;
    res.status(httpStatus).json(health);
  } catch (err) {
    console.error('[Solana Health Route Error]:', err);
    res.status(500).json({
      status: 'error',
      cluster: 'devnet',
      rpcConnected: false,
      error: 'Unexpected error checking Solana Devnet health.',
    });
  }
});
