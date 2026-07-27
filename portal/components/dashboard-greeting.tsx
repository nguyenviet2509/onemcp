'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { useCurrentSpace } from '@/lib/space-context';
import { getIdentity } from '@/lib/identity';

// Option A dashboard greeting: text-xl tracking-tight, muted subtext, inverted primary CTA.
export function DashboardGreeting() {
  const { space } = useCurrentSpace();
  const [identity, setIdentity] = useState<string | null>(null);

  useEffect(() => {
    setIdentity(getIdentity());
  }, []);

  const displayName = identity ?? 'there';

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
      {/* Left: greeting + space context */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Chào {displayName},
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {space.slug ? (
            <>
              Space: <span className="font-mono text-foreground">{space.slug}</span>
              {space.name && space.name !== space.slug && <> · {space.name}</>}
            </>
          ) : (
            'All spaces'
          )}
        </p>
      </div>

      {/* Right: primary CTA — inverted per Option A */}
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/artifacts/new" className={buttonVariants({ variant: 'default', size: 'sm' })}>
          Submit new
        </Link>
      </div>
    </div>
  );
}
