import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';

/**
 * Route protection.
 *
 * Only checks for the presence of the session cookie — signature verification
 * needs Node APIs unavailable in the Edge runtime, so each API route and page
 * still calls `getSession()` for the authoritative check. This is a cheap
 * redirect, not the security boundary.
 */
export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname, search } = request.nextUrl;

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/calendar'],
};
