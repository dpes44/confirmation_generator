import { Pool } from 'pg';
// Plain .mjs so scripts/db-push.mjs can share the exact same rule.
import { pgConnectionOptions } from './pg-ssl.mjs';

// Aiven's free tier allows only a small number of connections, and every
// serverless instance opens its own pool. Keep the pool tiny and let idle
// connections drop quickly so instances do not hoard slots.
function makePool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');

  const { connectionString, ssl } = pgConnectionOptions(url, process.env.DATABASE_CA_CERT);
  return new Pool({
    connectionString,
    ssl,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
  });
}

// Reuse the pool across hot reloads in dev and across invocations on a warm
// serverless instance.
const g = globalThis as unknown as { __pgPool?: Pool };
export const pool: Pool = g.__pgPool ?? (g.__pgPool = makePool());

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

export async function one<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
