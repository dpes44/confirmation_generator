import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/session';

export async function POST() {
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return res;
}
