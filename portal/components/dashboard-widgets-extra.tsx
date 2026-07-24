'use client';

import { useEffect, useState } from 'react';
import { listArtifacts, type Artifact } from '../lib/api/artifacts';
import { EmptyState } from './empty-state';
import { Card, CardHeader, CardContent, WidgetSkeleton } from './dashboard-widgets';

// ── Widget 4: Top Viewed ──────────────────────────────────────────────────────
// Uses view_count field from Phase 1. Falls back to empty state if all zero.
// NOTE: view_count not in Artifact type yet — we cast as unknown to read it
// defensively. TODO(backend): add view_count to Artifact type when Phase 1 field confirmed.

interface ArtifactWithViews extends Artifact {
  view_count?: number;
}

export function TopViewedWidget() {
  const [items, setItems] = useState<ArtifactWithViews[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listArtifacts({ status: 'published' })
      .then((all) => {
        const withViews = (all as ArtifactWithViews[]).sort(
          (a, b) => (b.view_count ?? 0) - (a.view_count ?? 0),
        );
        setItems(withViews.slice(0, 10));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, []);

  if (items === null && !error) return <WidgetSkeleton />;

  const allZero = items?.every((a) => !a.view_count);

  return (
    <Card>
      <CardHeader title="Top viewed" />
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : items?.length === 0 || allZero ? (
          <EmptyState
            title="No views yet"
            description="Published artifacts will rank here once they receive views."
          />
        ) : (
          <ol className="space-y-1">
            {items?.map((a, idx) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <span className="w-5 shrink-0 text-right text-xs text-secondary-400">{idx + 1}</span>
                <a
                  href={`/artifacts/${a.id}`}
                  className="flex-1 truncate text-secondary-900 hover:text-primary-600 dark:text-secondary-100 dark:hover:text-primary-400"
                >
                  {a.title}
                </a>
                <span className="shrink-0 text-xs text-secondary-400">{a.view_count ?? 0}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

// ── Widget 5: Top Tags ────────────────────────────────────────────────────────
// Aggregates tags from all published artifacts client-side.
// Clickable badges navigate to /artifacts?tag=<tag>.

interface TagCount {
  tag: string;
  count: number;
}

export function TopTagsWidget() {
  const [tags, setTags] = useState<TagCount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listArtifacts({ status: 'published' })
      .then((all) => {
        const counts = new Map<string, number>();
        for (const a of all) {
          for (const t of a.tags ?? []) {
            counts.set(t, (counts.get(t) ?? 0) + 1);
          }
        }
        const sorted = [...counts.entries()]
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
        setTags(sorted);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, []);

  if (tags === null && !error) return <WidgetSkeleton />;

  return (
    <Card>
      <CardHeader title="Top tags" />
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : tags?.length === 0 ? (
          <EmptyState title="No tags yet" description="Tag your artifacts to see them here." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags?.map(({ tag, count }) => (
              <a
                key={tag}
                href={`/artifacts?tag=${encodeURIComponent(tag)}`}
                className="inline-flex items-center gap-1 rounded-full border border-secondary-200 bg-secondary-50 px-2.5 py-0.5 text-xs font-medium text-secondary-700 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 dark:border-secondary-700 dark:bg-secondary-800 dark:text-secondary-300 dark:hover:border-primary-700 dark:hover:bg-primary-900 dark:hover:text-primary-300"
              >
                {tag}
                <span className="text-secondary-400 dark:text-secondary-500">{count}</span>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
