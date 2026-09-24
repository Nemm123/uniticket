import { Router, type Request, type Response } from 'express';
import type { QueryResultRow } from 'pg';
import { isSolanaWalletAddress, randomToken, sha256, verifySolanaMessageSignature, walletAuthMessage } from '../auth/crypto.js';
import { env } from '../config/env.js';
import { requireAuth, requireRole, type ServerRole } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

const NONCE_TTL_MS = env.authNonceTtlSeconds * 1_000;
const SESSION_TTL_MS = env.authSessionTtlSeconds * 1_000;

interface NonceRow extends QueryResultRow {
  id: string;
  wallet_address: string;
  nonce_hash: string;
  issued_at: Date;
  expires_at: Date;
  consumed_at: Date | null;
}

interface IdentityRow extends QueryResultRow {
  wallet_address: string;
  role: ServerRole;
}

export const authRouter = Router();

function walletFromBody(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const value = (body as { walletAddress?: unknown }).walletAddress;
  return typeof value === 'string' ? value.trim() : '';
}

function sendInvalidAuth(response: Response): void {
  response.status(401).json({ error: 'Wallet authentication could not be verified.' });
}

async function upsertVerifiedIdentity(client: import('pg').PoolClient, walletAddress: string): Promise<ServerRole> {
  const isBootstrapAdmin = env.adminWalletAddresses.has(walletAddress);
  const result = await client.query<IdentityRow>(
    `INSERT INTO wallet_identities (wallet_address, role)
     VALUES ($1, CASE WHEN $2 THEN 'admin' ELSE 'customer' END)
     ON CONFLICT (wallet_address) DO UPDATE
     SET role = CASE WHEN $2 THEN 'admin' ELSE wallet_identities.role END,
         updated_at = NOW()
     RETURNING wallet_address, role`,
    [walletAddress, isBootstrapAdmin],
  );
  return result.rows[0].role;
}

authRouter.post('/nonce', async (request: Request, response: Response) => {
  const walletAddress = walletFromBody(request.body);
  if (!isSolanaWalletAddress(walletAddress)) {
    response.status(400).json({ error: 'A valid Solana wallet address is required.' });
    return;
  }
  const nonce = randomToken();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + NONCE_TTL_MS);
  try {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO wallet_auth_nonces (wallet_address, nonce_hash, issued_at, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [walletAddress, sha256(nonce), issuedAt, expiresAt],
    );
    response.status(201).json({
      data: {
        nonceId: result.rows[0].id,
        nonce,
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        message: walletAuthMessage({ domain: env.authDomain, walletAddress, nonce, issuedAt, expiresAt }),
      },
    });
  } catch (error) {
    console.error('[UniTicket Auth] Failed to create wallet nonce:', error);
    response.status(503).json({ error: 'Authentication service is unavailable.' });
  }
});

authRouter.post('/verify', async (request: Request, response: Response) => {
  const body = request.body as { nonceId?: unknown; nonce?: unknown; signature?: unknown; walletAddress?: unknown };
  const walletAddress = walletFromBody(body);
  const nonceId = typeof body?.nonceId === 'string' ? body.nonceId.trim() : '';
  const nonce = typeof body?.nonce === 'string' ? body.nonce.trim() : '';
  const signature = typeof body?.signature === 'string' ? body.signature.trim() : '';
  if (!isSolanaWalletAddress(walletAddress) || !nonceId || !nonce || !signature) return sendInvalidAuth(response);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const nonceResult = await client.query<NonceRow>(
      'SELECT * FROM wallet_auth_nonces WHERE id = $1 FOR UPDATE',
      [nonceId],
    );
    const nonceRow = nonceResult.rows[0];
    if (
      !nonceRow || nonceRow.wallet_address !== walletAddress || nonceRow.nonce_hash !== sha256(nonce)
      || nonceRow.consumed_at !== null || nonceRow.expires_at <= new Date()
    ) {
      await client.query('ROLLBACK');
      return sendInvalidAuth(response);
    }
    const message = walletAuthMessage({ domain: env.authDomain, walletAddress, nonce, issuedAt: nonceRow.issued_at, expiresAt: nonceRow.expires_at });
    if (!verifySolanaMessageSignature(walletAddress, message, signature)) {
      await client.query('ROLLBACK');
      return sendInvalidAuth(response);
    }
    const role = await upsertVerifiedIdentity(client, walletAddress);
    const sessionToken = randomToken();
    const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await client.query('UPDATE wallet_auth_nonces SET consumed_at = NOW() WHERE id = $1', [nonceRow.id]);
    await client.query(
      'INSERT INTO auth_sessions (wallet_address, token_hash, expires_at) VALUES ($1, $2, $3)',
      [walletAddress, sha256(sessionToken), sessionExpiresAt],
    );
    await client.query('COMMIT');
    response.json({ data: { token: sessionToken, walletAddress, role, expiresAt: sessionExpiresAt.toISOString() } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[UniTicket Auth] Failed to verify wallet signature:', error);
    response.status(503).json({ error: 'Authentication service is unavailable.' });
  } finally {
    client.release();
  }
});

authRouter.get('/me', requireAuth, (request: Request, response: Response) => {
  response.json({ data: { walletAddress: request.auth!.walletAddress, role: request.auth!.role } });
});

authRouter.post('/logout', requireAuth, async (request: Request, response: Response) => {
  try {
    await pool.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL', [request.auth!.sessionId]);
    response.status(204).send();
  } catch (error) {
    console.error('[UniTicket Auth] Failed to revoke session:', error);
    response.status(503).json({ error: 'Authentication service is unavailable.' });
  }
});

authRouter.patch('/wallets/:walletAddress/role', requireAuth, requireRole('admin'), async (request: Request, response: Response) => {
  const walletAddress = typeof request.params.walletAddress === 'string' ? request.params.walletAddress.trim() : '';
  const role = (request.body as { role?: unknown })?.role;
  if (!isSolanaWalletAddress(walletAddress) || (role !== 'organizer' && role !== 'customer')) {
    response.status(400).json({ error: 'Only organizer or customer roles can be assigned to a valid wallet.' });
    return;
  }
  try {
    const result = await pool.query<IdentityRow>(
      `UPDATE wallet_identities
       SET role = $2, updated_at = NOW()
       WHERE wallet_address = $1 AND role <> 'admin'
       RETURNING wallet_address, role`,
      [walletAddress, role],
    );
    if (!result.rows[0]) {
      response.status(404).json({ error: 'Wallet identity was not found or is protected as an admin.' });
      return;
    }
    response.json({ data: { walletAddress: result.rows[0].wallet_address, role: result.rows[0].role } });
  } catch (error) {
    console.error('[UniTicket Auth] Failed to update wallet role:', error);
    response.status(503).json({ error: 'Authentication service is unavailable.' });
  }
});
