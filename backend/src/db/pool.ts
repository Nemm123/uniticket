import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 3_000,
});

pool.on('error', (error) => {
  console.error('[UniTicket DB] Unexpected idle client error:', error);
});

export async function checkDatabaseConnection(): Promise<void> {
  await pool.query('SELECT 1');
}
