import { NextResponse } from 'next/server';
import { checkPassword, issueToken } from '@/lib/auth';

export async function POST(req: Request) {
  let password = '';
  try {
    password = (await req.json())?.password ?? '';
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  try {
    if (!checkPassword(password)) {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
    }
  } catch (err: any) {
    // Missing APP_PASSWORD / AUTH_SECRET is a setup problem, not a bad password.
    return NextResponse.json({ error: err?.message ?? 'Login is not configured.' }, { status: 500 });
  }

  const token = issueToken();
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(token.name, token.value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: token.maxAge,
  });
  return res;
}
