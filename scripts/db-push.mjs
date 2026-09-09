// Applies db/schema.sql to DATABASE_URL. Idempotent - safe to re-run.
//   npm run db:push
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { pgConnectionOptions } from '../src/lib/pg-ssl.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Load .env.local / .env without adding a dotenv dependency.
for (const file of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(join(root, file), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
      if (!m) continue;
      const key = m[1];
      if (process.env[key]) continue; // real env wins
      let value = m[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch { /* file absent, fine */ }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  process.exit(1);
}

const client = new pg.Client(pgConnectionOptions(url, process.env.DATABASE_CA_CERT));

const sql = readFileSync(join(root, 'db', 'schema.sql'), 'utf8');

try {
  await client.connect();
  const { rows } = await client.query('select current_database() as db, version() as v');
  console.log(`connected to ${rows[0].db}`);
  // No bind parameters, so the simple query protocol runs the whole file.
  await client.query(sql);
  const t = await client.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`,
  );
  console.log('schema applied. tables:', t.rows.map((r) => r.table_name).join(', '));
} catch (err) {
  console.error('\nFailed:', err.message);
  if (/self.signed|certificate/i.test(err.message)) {
    console.error('TLS problem - either set DATABASE_CA_CERT from the Aiven console, or leave it blank to skip verification.');
  }
  if (/does not support SSL/i.test(err.message)) {
    console.error('That server has TLS turned off. Add ?sslmode=disable to DATABASE_URL (fine for a local database, never for Aiven).');
  }
  process.exit(1);
} finally {
  await client.end();
}
