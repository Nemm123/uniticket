import type { NextFunction, Request, Response } from 'express';
import type { QueryResultRow } from 'pg';
import { sha256 } from '../auth/crypto.js';
import { pool } from '../db/pool.js';

export type ServerRole = 'customer' | 'organizer' | 'staff' | 'admin';

interface SessionRow extends QueryResultRow {
  session_id: string;
  wallet_address: string;
  role: ServerRole;
}

function bearerToken(request: Request): string | null {
  const value = request.header('authorization');
  if (!value?.startsWith('Bearer ')) return null;
  const token = value.slice('Bearer '.length).trim();
  return token || null;
}

export async function requireAuth(request: Request, response: Response, next: NextFunction): Promise<void> {
  const token = bearerToken(request);
  if (!token) {
    response.status(401).json({ error: 'Authentication is required.' });
    return;
  }
  try {
    const result = await pool.query<SessionRow>(
      `SELECT s.id AS session_id, s.wallet_address, i.role
       FROM auth_sessions s
       JOIN wallet_identities i ON i.wallet_address = s.wallet_address
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
       LIMIT 1`,
      [sha256(token)],
    );
    const session = result.rows[0];
    if (!session) {
      response.status(401).json({ error: 'Session is invalid or expired.' });
      return;
    }
    request.auth = { sessionId: session.session_id, walletAddress: session.wallet_address, role: session.role };
    void pool.query('UPDATE auth_sessions SET last_seen_at = NOW() WHERE id = $1', [session.session_id]);
    next();
  } catch (error) {
    console.error('[UniTicket Auth] Session lookup failed:', error);
    response.status(503).json({ error: 'Authentication service is unavailable.' });
  }
}

/** Attaches a verified wallet session when supplied, while allowing guest order creation. */
export async function optionalAuth(request: Request, response: Response, next: NextFunction): Promise<void> {
  const token = bearerToken(request);
  if (!token) {
    next();
    return;
  }
  try {
    const result = await pool.query<SessionRow>(
      `SELECT s.id AS session_id, s.wallet_address, i.role
       FROM auth_sessions s
       JOIN wallet_identities i ON i.wallet_address = s.wallet_address
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
       LIMIT 1`,
      [sha256(token)],
    );
    const session = result.rows[0];
    if (!session) {
      response.status(401).json({ error: 'Session is invalid or expired.' });
      return;
    }
    request.auth = { sessionId: session.session_id, walletAddress: session.wallet_address, role: session.role };
    void pool.query('UPDATE auth_sessions SET last_seen_at = NOW() WHERE id = $1', [session.session_id]);
    next();
  } catch (error) {
    console.error('[UniTicket Auth] Optional session lookup failed:', error);
    response.status(503).json({ error: 'Authentication service is unavailable.' });
  }
}

export function requireRole(...roles: ServerRole[]) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!request.auth) {
      response.status(401).json({ error: 'Authentication is required.' });
      return;
    }
    if (!roles.includes(request.auth.role)) {
      response.status(403).json({ error: 'You do not have permission for this action.' });
      return;
    }
    next();
  };
}
