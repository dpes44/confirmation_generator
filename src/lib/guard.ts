import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { verifyToken } from './auth';
import { COOKIE_NAME } from './session';

async function signedIn(): Promise<boolean> {
  const jar = await cookies();
  return verifyToken(jar.get(COOKIE_NAME)?.value);
}

/** For pages: bounce to /login unless the cookie signature checks out. */
export async function requirePage(): Promise<void> {
  if (!(await signedIn())) redirect('/login');
}

/** For API routes: returns a 401 response to return early, or null when allowed. */
export async function requireApi(): Promise<NextResponse | null> {
  if (!(await signedIn())) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  return null;
}

/** Wraps a handler so thrown errors become JSON instead of an HTML error page. */
export async function guarded<T>(fn: () => Promise<T>): Promise<NextResponse> {
  const denied = await requireApi();
  if (denied) return denied;
  try {
    return NextResponse.json({ data: await fn() });
  } catch (err: any) {
    const message = err?.message ?? 'Something went wrong.';
    // Postgres unique-violation: report it as a conflict, not a server fault.
    const status = err?.code === '23505' ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
