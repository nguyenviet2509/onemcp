'use client';

import { useEffect, useState } from 'react';
import { useCurrentSpace } from '@/lib/space-context';
import { listArtifacts } from '@/lib/api/artifacts';
import { DashboardStatCard } from './dashboard-stat-card';

interface Counts {
  total: number | null;
  pending: number | null;
  drafts: number | null;
}

// 4-column stat cards grid (SEARCH HIT RATE hidden — no backend metric yet).
// Reuses listArtifacts() — no new backend calls.
// TODO(backend): add SEARCH HIT RATE 7D card when endpoint /api/metrics/search-hit-rate ships.
export function DashboardStatCards() {
  const { space } = useCurrentSpace();
  const [counts, setCounts] = useState<Counts>({ total: null, pending: null, drafts: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setCounts({ total: null, pending: null, drafts: null });

    const spaceParam = space.slug ? { space: space.slug } : {};

    Promise.allSettled([
      // Total published in current space
      listArtifacts({ ...spaceParam, status: 'published' }),
      // Pending review (all spaces for admin visibility)
      listArtifacts({ status: 'pending' }),
      // My drafts (author=me, any status, no space filter)
      listArtifacts({ status: 'pending', author: 'me' }),
    ]).then(([totalRes, pendingRes, draftsRes]) => {
      setCounts({
        total:   totalRes.status   === 'fulfilled' ? totalRes.value.length   : null,
        pending: pendingRes.status === 'fulfilled' ? pendingRes.value.length : null,
        drafts:  draftsRes.status  === 'fulfilled' ? draftsRes.value.length  : null,
      });
      setLoading(false);
    });
  }, [space.slug]);

  return (
    // 3 visible cards (SEARCH HIT RATE hidden) — responsive md:3 col
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <DashboardStatCard
        label="Total KB (space)"
        value={counts.total}
        subtext="Published artifacts"
        loading={loading}
      />
      <DashboardStatCard
        label="Pending review"
        value={counts.pending}
        subtext="Awaiting approval"
        valueColor={counts.pending ? 'text-amber-400' : undefined}
        loading={loading}
      />
      <DashboardStatCard
        label="My drafts"
        value={counts.drafts}
        subtext="Submitted by me"
        loading={loading}
      />
      {/* SEARCH HIT RATE 7D hidden — backend metric endpoint not available yet */}
    </div>
  );
}
