'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../lib/api-client';
import { listSkills, Skill } from '../../lib/api/skills';
import { Pagination, paginateItems } from '../../components/pagination';

// Option A skills list: px-8 py-6, divide-y row layout, chip tags, no bespoke colors.
export default function SkillsListPage() {
  const [items, setItems] = useState<Skill[]>([]);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<20 | 10 | 50 | 100>(20);

  useEffect(() => {
    setLoading(true);
    listSkills()
      .then(setItems)
      .catch((e) => setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((s) => {
      if (tag && !s.tags.includes(tag)) return false;
      if (!q) return true;
      return s.name.includes(q) || (s.description ?? '').toLowerCase().includes(q);
    });
  }, [items, query, tag]);

  // Reset to page 1 when filter changes
  const pagedFiltered = useMemo(() => {
    return paginateItems(filtered, page, pageSize);
  }, [filtered, page, pageSize]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((s) => s.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [items]);

  return (
    <main className="mx-auto max-w-5xl px-8 py-6">
      {/* Header row */}
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Skills</h1>
        <span className="text-xs text-muted-foreground">{items.length} skill(s)</span>
      </div>

      {/* Search + tag filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder="Search name or description..."
          className="h-8 flex-1 rounded-md border border-border bg-transparent px-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-3 focus:ring-ring/15 focus:border-foreground"
        />
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {/* "all" chip */}
            <button
              onClick={() => setTag(null)}
              className={`rounded border px-2 py-px text-[11px] font-medium transition-colors ${
                tag === null
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              all
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => setTag(t === tag ? null : t)}
                className={`rounded border px-2 py-px text-[11px] font-medium transition-colors ${
                  t === tag
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-foreground">No matching skills</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Skills sync automatically from GitLab via webhook.
          </p>
        </div>
      )}

      {/* Skill list — Option A: divide-y, no per-card shadow */}
      {!loading && filtered.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {pagedFiltered.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/skills/${encodeURIComponent(s.name)}`}
                  className="text-sm font-medium text-foreground hover:text-primary"
                >
                  {s.name}
                </Link>
                {s.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                )}
                {s.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {s.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded border border-border bg-muted px-2 py-px font-mono text-[11px] font-medium text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* Status chip — Option A style, no green/gray hardcoded */}
              <span
                className={`shrink-0 rounded border px-2 py-px text-[11px] font-medium ${
                  s.status === 'active'
                    ? 'border-transparent bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                    : 'border-border bg-muted text-muted-foreground'
                }`}
              >
                {s.status}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!loading && filtered.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      )}
    </main>
  );
}
