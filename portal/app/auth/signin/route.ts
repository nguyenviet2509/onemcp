// Route Handler auto-trigger Zitadel OAuth — plan onelog 260819-1628 phase-03.
// GET /auth/signin?callbackUrl=X → signIn('zitadel') sets CSRF cookie + throws
// NEXT_REDIRECT → browser follow tới Zitadel authorize. UX: skip default
// NextAuth signin provider button (chỉ 1 provider Zitadel duy nhất).
// Server Component page.tsx bị block khi setCookie — chỉ Route Handler được.

import { signIn } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const callbackUrl = req.nextUrl.searchParams.get('callbackUrl') ?? '/';
  await signIn('zitadel', { redirectTo: callbackUrl });
  // signIn throws NEXT_REDIRECT — không unreachable.
}
