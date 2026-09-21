import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  // Locate migrations folder relative to this file
  // In dev (src/db/migrate.ts): ../../migrations
  // In dist (dist/db/migrate.js): ../../migrations
  const possiblePaths = [
    path.resolve(__dirname, '../../migrations'),
    path.resolve(__dirname, '../migrations'),
    path.resolve(process.cwd(), 'migrations'),
    path.resolve(process.cwd(), 'backend/migrations'),
  ];

  let migrationsDir = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      migrationsDir = p;
      break;
    }
  }

  if (!migrationsDir) {
    console.warn('[UniTicket DB] Migrations directory not found. Skipping auto-migrations.');
    return;
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const appliedResult = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
    const appliedSet = new Set(appliedResult.rows.map(r => r.name));

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`[UniTicket DB] Running migration: ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[UniTicket DB] Successfully applied migration: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`[UniTicket DB] Failed to apply migration: ${file}`, error);
        throw error;
      }
    }
  } finally {
    client.release();
  }
}

// If run directly from command line
if (process.argv[1] && process.argv[1].endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  runMigrations()
    .then(() => {
      console.log('[UniTicket DB] All migrations completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[UniTicket DB] Migration error:', err);
      process.exit(1);
    });
}
