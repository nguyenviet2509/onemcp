// Custom signin page — auto-trigger Zitadel OAuth flow. Không show provider button
// vì OneMCP chỉ có 1 provider Zitadel. UX giống Grafana AUTO_LOGIN=true.
// signIn() từ Server Component gọi NEXT_REDIRECT internal → Next.js redirect
// browser tới Zitadel authorize endpoint.

import { signIn } from '@/lib/auth';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  await signIn('zitadel', { redirectTo: sp.callbackUrl ?? '/' });
  // signIn throws NEXT_REDIRECT — code below unreachable.
  return null;
}
