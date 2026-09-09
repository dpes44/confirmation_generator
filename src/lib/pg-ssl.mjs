/**
 * Builds the connection options for `pg` from a Postgres URL plus an optional
 * CA certificate.
 *
 * Why this exists rather than just handing `pg` the URL: when the connection
 * string carries `?sslmode=require`, pg-connection-string derives its own TLS
 * settings and verifies against the system CA store, which ignores a `ca` we
 * pass alongside it and fails Aiven's chain with "self-signed certificate in
 * certificate chain". So the sslmode parameter is stripped from the string and
 * the decision is made here, explicitly.
 *
 * Plain .mjs so the Next app and scripts/db-push.mjs share exactly one rule.
 *
 * @param {string} url  Postgres connection URI.
 * @param {string | undefined} caCert  PEM text; literal "\n" escapes are fine.
 * @returns {{ connectionString: string, ssl: false | { ca?: string, rejectUnauthorized: boolean } }}
 */
export function pgConnectionOptions(url, caCert) {
  let sslmode = '';
  let connectionString = url;

  try {
    const parsed = new URL(url);
    sslmode = (parsed.searchParams.get('sslmode') ?? '').toLowerCase();
    // Let the ssl object below be the single source of truth.
    parsed.searchParams.delete('sslmode');
    parsed.searchParams.delete('sslrootcert');
    connectionString = parsed.toString();
  } catch {
    // Not a parseable URL; hand it over untouched and use the secure default.
  }

  if (sslmode === 'disable') return { connectionString, ssl: false };

  const ca = caCert?.trim();
  if (ca) {
    // Env vars cannot hold real newlines, so accept the escaped form too.
    return {
      connectionString,
      ssl: { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true },
    };
  }

  // Encrypted, but the server certificate is not verified. Supplying Aiven's CA
  // in DATABASE_CA_CERT upgrades this to full verification.
  return { connectionString, ssl: { rejectUnauthorized: false } };
}
