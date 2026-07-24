'use client';

import { useEffect, useState } from 'react';
import { listArtifacts, type Artifact } from '../lib/api/artifacts';
import { EmptyState } from './empty-state';
import { WidgetSkeleton } from './dashboard-widgets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ── Widget 4: Top Viewed ──────────────────────────────────────────────────────
// Uses viewCount field from Artifact type (Phase 1C field confirmed).

export function TopViewedWidget() {
  const [items, setItems] = useState<Artifact[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listArtifacts({ status: 'published' })
      .then((all) => {
        const sorted = [...all].sort(
          (a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0),
        );
        setItems(sorted.slice(0, 10));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, []);

  if (items === null && !error) return <WidgetSkeleton />;

  const allZero = items?.every((a) => !a.viewCount);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Top viewed</CardTitle>
      </CardHeader>
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
                <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{idx + 1}</span>
                <a
                  href={`/artifacts/${a.id}`}
                  className="flex-1 truncate text-foreground hover:text-primary"
                >
                  {a.title}
                </a>
                <span className="shrink-0 text-xs text-muted-foreground">{a.viewCount ?? 0}</span>
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
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Top tags</CardTitle>
      </CardHeader>
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
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              >
                {tag}
                <span className="text-muted-foreground/60">{count}</span>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
