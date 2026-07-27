'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getIdentity } from '@/lib/identity';

const PORTAL_VERSION = 'v1.5';

// Brand block: small square mark + wordmark + version + current identity.
// Mark uses foreground token so it flips between light/dark automatically.
export function SidebarBrand() {
  const [identity, setIdentity] = useState<string | null>(null);

  useEffect(() => {
    setIdentity(getIdentity());
  }, []);

  return (
    <div className="flex items-center gap-2.5 px-3.5 py-3.5 border-b border-sidebar-border">
      <span
        aria-hidden
        className="grid size-6 shrink-0 place-items-center rounded-md bg-foreground text-background text-[11px] font-bold tracking-tight"
      >
        O
      </span>
      <Link
        href="/"
        className="min-w-0 flex-1 leading-tight"
        aria-label="OneMCP home"
      >
        <span className="block text-sm font-semibold text-sidebar-foreground">OneMCP</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {PORTAL_VERSION}
          {identity ? (
            <> · <span className="text-foreground/70">{identity}</span></>
          ) : (
            <> · <span className="italic text-muted-foreground/70">sign in</span></>
          )}
        </span>
      </Link>
    </div>
  );
}
