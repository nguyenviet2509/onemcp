'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { useCurrentSpace } from '@/lib/space-context';
import { getIdentity } from '@/lib/identity';

// Dashboard greeting header + space breadcrumb + CTA row.
// Static greeting (no dynamic time-based "good morning" — KISS).
// Import CTA hidden — no backend endpoint yet.
// TODO(backend): unhide Import CTA when /api/artifacts/import endpoint ships.
export function DashboardGreeting() {
  const { space } = useCurrentSpace();
  const [identity, setIdentity] = useState<string | null>(null);

  useEffect(() => {
    setIdentity(getIdentity());
  }, []);

  // Display first segment of identity as first name (e.g. "trihd" → "trihd")
  const displayName = identity ?? 'there';

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      {/* Left: greeting + space context */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">
          Chào {displayName},
        </h1>
        {space.slug ? (
          <p className="mt-1 text-sm text-slate-400">
            Space:{' '}
            <span className="font-mono text-slate-300">{space.slug}</span>
            {space.name && space.name !== space.slug && (
              <> · {space.name}</>
            )}
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">All spaces</p>
        )}
      </div>

      {/* Right: CTAs — Import hidden, Submit new visible */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Import CTA hidden until backend endpoint ready */}
        <Link
          href="/artifacts/new"
          className={buttonVariants({ variant: 'default', size: 'sm' })}
        >
          Submit new
        </Link>
      </div>
    </div>
  );
}
