import { createHmac, timingSafeEqual } from 'node:crypto';
import { COOKIE_NAME, SESSION_MAX_AGE } from './session';

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error('AUTH_SECRET is not set (or is too short). Generate one with: openssl rand -hex 32');
  }
  return s;
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

/** Builds a cookie value of the form "<expiryEpochSeconds>.<hmac>". */
export function issueToken(): { name: string; value: string; maxAge: number } {
  const expiry = String(Math.floor(Date.now() / 1000) + SESSION_MAX_AGE);
  return { name: COOKIE_NAME, value: `${expiry}.${sign(expiry)}`, maxAge: SESSION_MAX_AGE };
}

export function verifyToken(value: string | undefined | null): boolean {
  if (!value) return false;
  const dot = value.lastIndexOf('.');
  if (dot < 1) return false;

  const expiry = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  if (!/^\d+$/.test(expiry)) return false;
  if (Number(expiry) * 1000 < Date.now()) return false;

  let expected: Buffer;
  let given: Buffer;
  try {
    expected = Buffer.from(sign(expiry), 'base64url');
    given = Buffer.from(mac, 'base64url');
  } catch {
    return false;
  }
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Constant-time comparison of a submitted password against APP_PASSWORD. */
export function checkPassword(submitted: string): boolean {
  const real = process.env.APP_PASSWORD ?? '';
  if (!real) throw new Error('APP_PASSWORD is not set.');
  const a = Buffer.from(submitted);
  const b = Buffer.from(real);
  // Hash both sides so lengths always match and no length is leaked.
  const ha = createHmac('sha256', secret()).update(a).digest();
  const hb = createHmac('sha256', secret()).update(b).digest();
  return timingSafeEqual(ha, hb);
}

export { COOKIE_NAME } from './session';
