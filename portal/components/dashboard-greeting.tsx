'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { buttonVariants } from '@/components/ui/button';
import { useCurrentSpace } from '@/lib/space-context';
import { apiFetch } from '@/lib/api-client';

interface MeResponse {
  username: string;
}

// Option A dashboard greeting: text-xl tracking-tight, muted subtext, inverted primary CTA.
// Username sourced from /api/me (SSO) instead of localStorage identity.
export function DashboardGreeting() {
  const { space } = useCurrentSpace();
  const [username, setUsername] = useState<string | null>(null);
  const t = useTranslations('pages.dashboard');
  const tSpaces = useTranslations('pages.spaces.switcher');
  const tArtifacts = useTranslations('pages.artifacts');

  useEffect(() => {
    apiFetch<MeResponse>('/me')
      .then((me) => setUsername(me.username))
      .catch(() => {
        // 401 handled by api-client (redirect). Other errors: show anon greeting.
      });
  }, []);

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
      {/* Left: greeting + space context */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {username ? t('greeting', { name: username }) : t('greetingAnon')}
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
