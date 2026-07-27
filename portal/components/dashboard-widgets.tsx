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
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-2.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="mt-1.5 h-3 w-1/3" />
            </div>
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
// Option A row layout: divide-y divide-border, hover:bg-muted, no icons.

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
        setItems(sorted.slice(0, 5));
      })
      .catch((e) => setError(e));
  }, [space.slug]);

  if (items === null && !error) return <WidgetSkeleton />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <div className="px-4 py-3"><WidgetError err={error} /></div>
        ) : items?.length === 0 ? (
          <div className="px-4 py-3">
            <EmptyState size="compact" title="No recent activity" />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items?.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors">
                {/* Status color bar — matches Option A accent bar */}
                <div className={`w-1 h-5 shrink-0 rounded-full ${statusBarColor(a.status)}`} />
                <div className="min-w-0 flex-1">
                  <a
                    href={`/artifacts/${a.id}`}
                    className="block truncate text-sm font-medium text-foreground hover:text-primary"
                  >
                    {a.title}
                  </a>
                  <p className="mt-0.5 text-xs text-muted-foreground">{relativeTime(a.updatedAt)}</p>
                </div>
                {a.type && (
                  <Badge variant="default" className="shrink-0">{a.type}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// Maps artifact status → Option A accent color class for the bar
function statusBarColor(status: string): string {
  switch (status) {
    case 'published': return 'bg-emerald-500';
    case 'pending':   return 'bg-amber-500';
    case 'draft':     return 'bg-muted-foreground';
    case 'archived':  return 'bg-muted-foreground/50';
    default:          return 'bg-muted-foreground/50';
  }
}

// ── Widget 2: My Drafts ───────────────────────────────────────────────────────

export function MyDraftsWidget() {
  const [items, setItems] = useState<Artifact[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    listArtifacts({ status: 'pending', author: 'me' })
      .then((all) => setItems(all.slice(0, 5)))
      .catch((e) => setError(e));
  }, []);

  if (items === null && !error) return <WidgetSkeleton />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>My drafts</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <div className="px-4 py-3"><WidgetError err={error} /></div>
        ) : items?.length === 0 ? (
          <div className="px-4 py-3">
            <EmptyState size="compact" title="No drafts" />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items?.map((a) => (
              <li key={a.id}>
                <a
                  href={`/artifacts/${a.id}`}
                  className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors"
                >
                  <span className="truncate text-foreground">{a.title}</span>
                  <span className="ml-3 shrink-0 text-xs text-muted-foreground">{relativeTime(a.updatedAt)}</span>
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
        <CardTitle>Pending review</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <WidgetError err={error} />
        ) : count === null ? (
          <Skeleton className="h-8 w-full" />
        ) : count === 0 ? (
          <EmptyState size="compact" title="Nothing to review" />
        ) : (
          <div className="flex items-center justify-between">
            {/* Option A stat number: 26px tracking-tight */}
            <span className="text-[26px] font-semibold leading-none tracking-tight text-foreground">{count}</span>
            <a
              href="/artifacts/review"
              className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 transition-opacity"
            >
              Review
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
