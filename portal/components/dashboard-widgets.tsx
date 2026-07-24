'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { FileText, Clock } from 'lucide-react';
import { listArtifacts, type Artifact } from '../lib/api/artifacts';
import { useCurrentSpace } from '../lib/space-context';
import { EmptyState } from './empty-state';
import { getIdentity } from '../lib/identity';

// ── Shared card primitives (no Radix — not installed; pure Tailwind) ─────────

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-secondary-200 bg-white shadow-card dark:border-secondary-800 dark:bg-secondary-900 ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-secondary-100 px-4 py-3 dark:border-secondary-800">
      {icon && <span className="text-secondary-400 dark:text-secondary-500" aria-hidden>{icon}</span>}
      <h2 className="text-sm font-semibold text-secondary-700 dark:text-secondary-300">{title}</h2>
    </div>
  );
}

export function CardContent({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3">{children}</div>;
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

export function WidgetSkeleton() {
  return (
    <Card>
      <CardHeader title="" />
      <CardContent>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-secondary-100 dark:bg-secondary-800" />
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
      <CardHeader title="Recent activity" icon={<Clock className="h-4 w-4" />} />
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : items?.length === 0 ? (
          <EmptyState title="No recent activity" description="Artifacts will appear here once created." />
        ) : (
          <ul className="divide-y divide-secondary-100 dark:divide-secondary-800">
            {items?.map((a) => (
              <li key={a.id} className="flex items-start gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <a
                    href={`/artifacts/${a.id}`}
                    className="font-medium text-secondary-900 hover:text-primary-600 dark:text-secondary-100 dark:hover:text-primary-400"
                  >
                    {a.title}
                  </a>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-secondary-500 dark:text-secondary-400">
                    <span className="rounded bg-secondary-100 px-1.5 py-0.5 font-mono dark:bg-secondary-800">
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
    // Backend supports status filter; author=me not supported server-side yet —
    // fetch drafts and filter by identity client-side.
    // TODO(backend): add ?author=me param to avoid over-fetching.
    listArtifacts({ status: 'pending' })
      .then((all) => {
        const me = getIdentity();
        const mine = me
          ? all.filter((a) => String(a.ownerId) === me || a.ownerId.toString() === me)
          : all;
        setItems(mine.slice(0, 5));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, []);

  if (items === null && !error) return <WidgetSkeleton />;

  return (
    <Card>
      <CardHeader title="My drafts" />
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
                  className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-secondary-50 dark:hover:bg-secondary-800"
                >
                  <span className="truncate text-secondary-900 dark:text-secondary-100">{a.title}</span>
                  <span className="ml-2 shrink-0 text-xs text-secondary-400">{relativeTime(a.updatedAt)}</span>
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
      <CardHeader title="Pending review" />
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : count === null ? (
          <div className="h-8 animate-pulse rounded bg-secondary-100 dark:bg-secondary-800" />
        ) : count === 0 ? (
          <EmptyState title="Nothing to review" description="All caught up." />
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold text-secondary-900 dark:text-secondary-50">{count}</span>
            <a
              href="/artifacts/review"
              className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              Review
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
