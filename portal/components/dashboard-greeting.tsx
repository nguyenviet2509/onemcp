'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { buttonVariants } from '@/components/ui/button';
import { useCurrentSpace } from '@/lib/space-context';
import { useCurrentUser } from '@/lib/auth';

// Option A dashboard greeting: text-xl tracking-tight, muted subtext, inverted primary CTA.
// Name sourced from SSO session (/api/auth/me) — no localStorage identity.
export function DashboardGreeting() {
  const { space } = useCurrentSpace();
  const currentUser = useCurrentUser();
  const t = useTranslations('pages.dashboard');
  const tSpaces = useTranslations('pages.spaces.switcher');
  const tArtifacts = useTranslations('pages.artifacts');

  // Prefer displayName, fall back to username, then email prefix.
  const name = currentUser?.displayName
    ?? currentUser?.username
    ?? currentUser?.email?.split('@')[0]
    ?? null;

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
      {/* Left: greeting + space context */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {name ? t('greeting', { name }) : t('greetingAnon')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {space.slug ? (
            <>
              Space: <span className="font-mono text-foreground">{space.slug}</span>
              {space.name && space.name !== space.slug && <> · {space.name}</>}
            </>
          ) : (
            tSpaces('allSpaces')
          )}
        </p>
      </div>

      {/* Right: primary CTA — inverted per Option A */}
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/artifacts/new" className={buttonVariants({ variant: 'default', size: 'sm' })}>
          {tArtifacts('submitNew')}
        </Link>
      </div>
    </div>
  );
}
