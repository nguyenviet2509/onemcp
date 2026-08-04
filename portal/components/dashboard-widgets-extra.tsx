'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { listArtifacts, type Artifact } from '../lib/api/artifacts';
import { EmptyState } from './empty-state';
import { WidgetError } from './widget-error';
import { WidgetSkeleton } from './dashboard-widgets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ── Widget 4: Top Viewed ──────────────────────────────────────────────────────
// Option A row layout: numbered list, rank muted, count muted right-aligned.

export function TopViewedWidget() {
  const [items, setItems] = useState<Artifact[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const t = useTranslations('widgets');

  useEffect(() => {
    listArtifacts({ status: 'published' })
      .then((all) => {
        const sorted = [...all].sort(
          (a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0),
        );
        setItems(sorted.slice(0, 5));
      })
      .catch((e) => setError(e));
  }, []);

  if (items === null && !error) return <WidgetSkeleton />;

  const allZero = items?.every((a) => !a.viewCount);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('popularArtifacts')} · 7d</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <div className="px-4 py-3"><WidgetError err={error} /></div>
        ) : items?.length === 0 || allZero ? (
          <div className="px-4 py-3">
            <EmptyState size="compact" title={t('noViews')} />
          </div>
        ) : (
          <ol className="divide-y divide-border">
            {items?.map((a, idx) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50 transition-colors">
                {/* Rank number — muted, fixed width */}
                <span className="w-4 shrink-0 text-right text-xs text-muted-foreground">{idx + 1}</span>
                <a
                  href={`/artifacts/${a.id}`}
                  className="flex-1 truncate text-sm text-foreground hover:text-primary"
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
// Option A chip layout: rounded (not pill), 11px text, panel-2 bg.

interface TagCount {
  tag: string;
  count: number;
}

export function TopTagsWidget() {
  const [tags, setTags] = useState<TagCount[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const t = useTranslations('widgets');

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
      .catch((e) => setError(e));
  }, []);

  if (tags === null && !error) return <WidgetSkeleton />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('tags')}</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <WidgetError err={error} />
        ) : tags?.length === 0 ? (
          <EmptyState size="compact" title={t('noTags')} />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tags?.map(({ tag, count }) => (
              <a
                key={tag}
                href={`/artifacts?tag=${encodeURIComponent(tag)}`}
                // Option A chip: rounded (4px), border, panel-2 bg, 11px text, no pill
                className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-px text-[11px] font-medium text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
              >
                {tag}
                <span className="text-muted-foreground/60">· {count}</span>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
