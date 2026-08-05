import { NextRequest, NextResponse } from 'next/server';

// Edge-safe middleware — no Node.js imports (no fs, crypto, etc.).
// Auth is always GitLab SSO — cookie check runs on every request.
// No AUTH_MODE gate: portal is SSO-only, legacy trust-header mode removed.

const SESSION_COOKIE = 'onemcp_session';

// Paths exempt from auth check — regex tested against pathname.
const PUBLIC_PATH = /^(\/login|\/health|\/favicon\.ico)(\/.*)?$/;

// Static asset prefixes that never need auth.
const STATIC_PREFIX = /^\/_next\//;

// /api/auth/* — backend handles its own auth (OAuth flow must be public).
const AUTH_API_PREFIX = /^\/api\/auth\//;

// Sanitise returnTo: must start with '/', reject '//' and backslash (open-redirect guard).
function sanitiseReturnTo(pathname: string): string {
  if (
    !pathname.startsWith('/') ||
    pathname.startsWith('//') ||
    pathname.startsWith('/\\')
  ) {
    return '/';
  }
  return pathname;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Exempt public paths and static assets.
  if (
    PUBLIC_PATH.test(pathname) ||
    STATIC_PREFIX.test(pathname) ||
    AUTH_API_PREFIX.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Check session cookie.
  const session = req.cookies.get(SESSION_COOKIE);
  if (session?.value) {
    return NextResponse.next();
  }

  // No session — redirect to login with returnTo.
  const returnTo = sanitiseReturnTo(pathname + req.nextUrl.search);
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = `?returnTo=${encodeURIComponent(returnTo)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Apply to all routes except static files and Next internals.
  // Fine-grained exclusion handled inside the middleware function above.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
