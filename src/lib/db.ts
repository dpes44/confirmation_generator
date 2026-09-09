import { Pool } from 'pg';
// Plain .mjs so scripts/db-push.mjs can share the exact same rule.
import { pgConnectionOptions } from './pg-ssl.mjs';

// Aiven's free tier allows only a small number of connections, and every
// serverless instance opens its own pool. Keep the pool tiny and let idle
// connections drop quickly so instances do not hoard slots.
function makePool(): Pool {
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

// Built on first use, never at import time. `next build` imports every route to
// collect its config, and a build must not need runtime secrets - creating the
// pool eagerly turns a missing DATABASE_URL into a failed build instead of a
// clear message in the running app.
//
// The instance is cached on globalThis so it survives hot reloads in dev and is
// reused across invocations on a warm serverless instance.
const g = globalThis as unknown as { __pgPool?: Pool };

export function getPool(): Pool {
  return (g.__pgPool ??= makePool());
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const res = await getPool().query(sql, params);
  return res.rows as T[];
}

export async function one<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
