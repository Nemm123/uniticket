import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

const isRemoteDb =
  env.databaseSsl ||
  env.databaseUrl.includes('neon.tech') ||
  env.databaseUrl.includes('render.com') ||
  env.databaseUrl.includes('sslmode=require');

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) => {
  console.error('[UniTicket DB] Unexpected idle client error:', error);
});

export async function checkDatabaseConnection(): Promise<void> {
  await pool.query('SELECT 1');
}
