import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_NAME } from '@/lib/session';

/**
 * Gates the whole app behind the shared password.
 *
 * This only checks that a session cookie is *present* — the Edge runtime cannot
 * use node:crypto, so the signature itself is verified by `requirePage()` /
 * `requireApi()` on every page and route. The proxy is the redirect for humans;
 * those guards are the actual security boundary.
 */
export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  if (!req.cookies.get(COOKIE_NAME)?.value) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
