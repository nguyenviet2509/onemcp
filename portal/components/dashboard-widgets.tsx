'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Clock } from 'lucide-react';
import { listArtifacts, type Artifact } from '../lib/api/artifacts';
import { useCurrentSpace } from '../lib/space-context';
import { EmptyState } from './empty-state';
import { getIdentity } from '../lib/identity';
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

// ── Relative time helper (date-fns installed) ─────────────────────────────────

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

// ── Widget 1: Recent Activity ─────────────────────────────────────────────────

export function RecentActivityWidget() {
  const { space } = useCurrentSpace();
  const [items, setItems] = useState<Artifact[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(null);
    listArtifacts({ ...(space.slug ? { space: space.slug } : {}) })
      .then((all) => {
        const sorted = [...all].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        setItems(sorted.slice(0, 10));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [space.slug]);

  if (items === null && !error) return <WidgetSkeleton />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
          Recent activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
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
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
                      {a.type}
                    </span>
                    <span>{relativeTime(a.updatedAt)}</span>
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Backend now supports ?author=me — filter server-side to avoid over-fetching.
    listArtifacts({ status: 'pending', author: 'me' })
      .then((all) => {
        setItems(all.slice(0, 5));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, []);

  if (items === null && !error) return <WidgetSkeleton />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">My drafts</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listArtifacts({ status: 'pending' })
      .then((all) => setCount(all.length))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Pending review</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : count === null ? (
          <Skeleton className="h-8 w-full" />
        ) : count === 0 ? (
          <EmptyState title="Nothing to review" description="All caught up." />
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold text-foreground">{count}</span>
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
