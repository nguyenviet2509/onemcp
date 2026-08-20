// Portal auth middleware — Cơ chế 1 dual-mode (plan 260819-1628 phase-03).
//
// AUTH_MODE=iap    (default) — legacy oauth2-proxy IAP handle auth qua nginx.
//                              Skip NextAuth check ở đây, request đi thẳng UI.
// AUTH_MODE=oidc            — NextAuth v5 session required. Chưa auth → redirect
//                              /api/auth/signin?callbackUrl=<current>.
//
// Path exempt (mọi mode): /api/auth/* (NextAuth handlers), /health, static assets.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

const AUTH_MODE = process.env.AUTH_MODE ?? 'iap';

// Path bypass — không cần session dù mode nào.
function isBypassed(pathname: string): boolean {
  if (pathname.startsWith('/api/auth/')) return true; // NextAuth handlers
  if (pathname.startsWith('/auth/')) return true; // Custom signin page (auto-trigger OAuth)
  if (pathname === '/health') return true;
  if (pathname.startsWith('/_next/')) return true; // Next assets
  if (pathname.startsWith('/favicon')) return true;
  return false;
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (AUTH_MODE !== 'oidc' || isBypassed(pathname)) return NextResponse.next();

  const session = await auth();
  if (!session) {
    // Redirect tới custom signin page → auto-trigger Zitadel OAuth (không show button).
    const signInUrl = new URL('/auth/signin', req.nextUrl.origin);
    signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
}

// Match tất cả routes trừ static + api/auth (đã bypass ở isBypassed).
// matcher tối giản để middleware chạy trên navigation + API portal calls.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
