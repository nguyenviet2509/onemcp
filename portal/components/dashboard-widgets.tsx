'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { listArtifacts, type Artifact } from '../lib/api/artifacts';
import { statusVariant } from '../lib/status-pill-variants';
import { useCurrentSpace } from '../lib/space-context';
import { EmptyState } from './empty-state';
import { WidgetError } from './widget-error';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// ── Skeleton loader ───────────────────────────────────────────────────────────

export function WidgetSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle><Skeleton className="h-4 w-32" /></CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Relative time helper ──────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

// ── Widget 1: Recent Activity ─────────────────────────────────────────────────
// Clock icon removed (Phase 2 icon purge). Section title text-only.
// Status pill uses shadcn Badge — semantic variants applied in Phase 3.

export function RecentActivityWidget() {
  const { space } = useCurrentSpace();
  const [items, setItems] = useState<Artifact[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setItems(null);
    setError(null);
    listArtifacts({ ...(space.slug ? { space: space.slug } : {}) })
      .then((all) => {
        const sorted = [...all].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        setItems(sorted.slice(0, 10));
      })
      .catch((e) => setError(e));
  }, [space.slug]);

  if (items === null && !error) return <WidgetSkeleton />;

  return (
    <Card>
      {/* Section title text-only — no icon (icon budget: 0 outside sidebar-nav) */}
      <CardHeader>
        <CardTitle className="text-base font-semibold">Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <WidgetError err={error} />
        ) : items?.length === 0 ? (
          <EmptyState title="No recent activity" description="Artifacts will appear here once created." />
        ) : (
          <ul className="divide-y divide-border">
            {items?.map((a) => (
              <li key={a.id} className="flex items-start gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <a
                    href={`/artifacts/${a.id}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {a.title}
                  </a>
                  {/* Semantic status + template pills */}
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant={statusVariant(a.status)} className="text-[10px] px-1 py-0">
                      {a.status}
                    </Badge>
                    {a.type && (
                      <Badge variant="template" className="font-mono text-[10px] px-1 py-0">
                        {a.type}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{relativeTime(a.updatedAt)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── Widget 2: My Drafts ───────────────────────────────────────────────────────

export function MyDraftsWidget() {
  const [items, setItems] = useState<Artifact[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    listArtifacts({ status: 'pending', author: 'me' })
      .then((all) => {
        setItems(all.slice(0, 5));
      })
      .catch((e) => setError(e));
  }, []);

  if (items === null && !error) return <WidgetSkeleton />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">My drafts</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <WidgetError err={error} />
        ) : items?.length === 0 ? (
          <EmptyState title="No drafts" description="Artifacts you submit will appear here." />
        ) : (
          <ul className="space-y-1">
            {items?.map((a) => (
              <li key={a.id}>
                <a
                  href={`/artifacts/${a.id}`}
                  className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span className="truncate text-foreground">{a.title}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">{relativeTime(a.updatedAt)}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── Widget 3: Pending Review ──────────────────────────────────────────────────

export function PendingReviewWidget() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    listArtifacts({ status: 'pending' })
      .then((all) => setCount(all.length))
      .catch((e) => setError(e));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Pending review</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <WidgetError err={error} />
        ) : count === null ? (
          <Skeleton className="h-8 w-full" />
        ) : count === 0 ? (
          <EmptyState title="Nothing to review" description="All caught up." />
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-2xl font-semibold leading-tight text-foreground">{count}</span>
            <a
              href="/artifacts/review"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Review
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
