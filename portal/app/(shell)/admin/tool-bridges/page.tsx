'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { PageShell } from '@/components/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { ToolBridgesTabs } from './tool-bridges-tabs';

interface MeMinimal { roles?: string[] }

function isAdmin(roles: string[] | undefined): boolean {
  return roles?.some((r) => r === 'super-admin' || r === 'dept-admin') ?? false;
}

// Client component — fetches session role client-side then renders tabs.
// Server-side redirect not used here (no auth() in portal's IAP mode);
// backend still enforces the guard on every API call (defense-in-depth).
export default function ToolBridgesPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [permitted, setPermitted] = useState(false);

  useEffect(() => {
    apiFetch<MeMinimal>('/me')
      .then((me) => {
        if (isAdmin(me?.roles)) {
          setPermitted(true);
        } else {
          router.replace('/');
        }
      })
      .catch(() => router.replace('/'))
      .finally(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <PageShell title="Tool bridges" breadcrumb={[{ label: 'Admin' }, { label: 'Tool bridges' }]}>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      </PageShell>
    );
  }

  if (!permitted) return null;

  return (
    <PageShell
      title="Tool bridges"
      breadcrumb={[{ label: 'Admin' }, { label: 'Tool bridges' }]}
    >
      <Suspense fallback={<Skeleton className="h-40 w-full rounded-lg" />}>
        <ToolBridgesTabs />
      </Suspense>
    </PageShell>
  );
}
