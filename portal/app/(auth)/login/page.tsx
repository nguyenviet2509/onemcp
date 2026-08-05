import { GitBranch } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in — OneMCP',
};

interface LoginPageProps {
  searchParams: Promise<{ returnTo?: string }>;
}

// Sanitise returnTo: must start with '/', must not start with '//' or contain ':'.
// Prevents open-redirect via //evil.com or javascript: URIs.
function sanitiseReturnTo(raw: string | undefined): string {
  if (!raw) return '/';
  const decoded = decodeURIComponent(raw);
  if (
    !decoded.startsWith('/') ||
    decoded.startsWith('//') ||
    decoded.startsWith('/\\') ||
    decoded.includes(':')
  ) {
    return '/';
  }
  return decoded;
}

// Login page — Server Component. Renders a single CTA button that redirects the
// browser to the backend OAuth entry point with an optional returnTo param.
// No client-side JS required — the button is a plain anchor styled as a button.
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const returnTo = sanitiseReturnTo(params.returnTo);
  const loginHref = `/api/auth/gitlab/login?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            OneMCP
          </h1>
          <p className="text-sm text-muted-foreground">
            Internal MCP portal — iNET Engineering
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm space-y-6">
          <div className="space-y-1 text-center">
            <h2 className="text-base font-medium text-foreground">Sign in to continue</h2>
            <p className="text-xs text-muted-foreground">
              Use your iNET GitLab account to authenticate
            </p>
          </div>

          {/* CTA — plain anchor, no JS needed */}
          <a
            href={loginHref}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-foreground bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <GitBranch className="size-4 shrink-0" aria-hidden />
            Sign in with iNET GitLab
          </a>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Access restricted to iNET Engineering accounts
        </p>
      </div>
    </main>
  );
}
