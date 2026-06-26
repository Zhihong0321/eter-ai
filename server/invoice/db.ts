/**
 * Shared read-only Postgres pool.
 *
 * Connects directly to the database using DATABASE_URL (on Railway this is the
 * internal connection string, e.g. postgresql://user:pass@host.railway.internal:5432/db).
 * The connection string and credentials stay server-side and are never sent to
 * the browser.
 */

import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Lazily create (and reuse) a single connection pool.
 * Returns null when DATABASE_URL is not configured so callers can surface a
 * clear "not configured" error instead of throwing on import.
 */
export function getPool(): pg.Pool | null {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  // Railway internal connections (*.railway.internal) do not use SSL.
  // Set DATABASE_SSL=true when connecting over a public/proxied host.
  const useSsl = process.env.DATABASE_SSL === 'true';

  pool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on('error', (err) => {
    console.error('[db] Idle client error:', err.message);
  });

  return pool;
}
