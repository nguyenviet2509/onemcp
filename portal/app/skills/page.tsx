'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError } from '../../lib/api-client';
import { listSkills, Skill } from '../../lib/api/skills';
import { Pagination, paginateItems } from '../../components/pagination';

// Option A skills list: px-8 py-6, divide-y row layout, chip tags, no bespoke colors.
export default function SkillsListPage() {
  const [items, setItems] = useState<Skill[]>([]);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [projectSlug, setProjectSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<20 | 10 | 50 | 100>(20);
  const t = useTranslations('pages.skills');
  const tCommon = useTranslations('common');

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
      if (projectSlug !== null) {
        const ownedByProject = projectSlug === '__legacy__' ? s.projectSlug === null : s.projectSlug === projectSlug;
        if (!ownedByProject) return false;
      }
      if (!q) return true;
      return s.name.includes(q) || (s.description ?? '').toLowerCase().includes(q);
    });
  }, [items, query, tag, projectSlug]);

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    let hasLegacy = false;
    items.forEach((s) => {
      if (s.projectSlug && s.projectName) map.set(s.projectSlug, s.projectName);
      else if (!s.projectSlug) hasLegacy = true;
    });
    return { list: Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])), hasLegacy };
  }, [items]);

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
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
        <span className="text-xs text-muted-foreground">{t('count', { count: items.length })}</span>
      </div>

      {/* Project filter */}
      {(projects.list.length > 0 || projects.hasLegacy) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Project:</span>
          <button
            onClick={() => { setProjectSlug(null); setPage(1); }}
            className={`rounded border px-2 py-px text-[11px] font-medium transition-colors ${
              projectSlug === null
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            all
          </button>
          {projects.list.map(([slug, name]) => (
            <button
              key={slug}
              onClick={() => { setProjectSlug(slug === projectSlug ? null : slug); setPage(1); }}
              className={`rounded border px-2 py-px text-[11px] font-medium transition-colors ${
                slug === projectSlug
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-muted text-muted-foreground hover:text-foreground'
              }`}
              title={name}
            >
              {slug}
            </button>
          ))}
          {projects.hasLegacy && (
            <button
              onClick={() => { setProjectSlug('__legacy__' === projectSlug ? null : '__legacy__'); setPage(1); }}
              className={`rounded border px-2 py-px text-[11px] font-medium transition-colors ${
                projectSlug === '__legacy__'
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-muted text-muted-foreground hover:text-foreground'
              }`}
              title="Legacy mono-repo skills (no project)"
            >
              legacy
            </button>
          )}
        </div>
      )}

      {/* Search + tag filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder={t('searchPlaceholder')}
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
              {t('filterAll')}
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

      {loading && <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-foreground">{t('noMatch')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('syncNote')}
          </p>
        </div>
      )}

      {/* Skill list — Option A: divide-y, no per-card shadow */}
      {!loading && filtered.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {pagedFiltered.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/skills/${encodeURIComponent(s.name)}`}
                    className="text-sm font-medium text-foreground hover:text-primary"
                  >
                    {s.name}
                  </Link>
                  {s.projectSlug && (
                    <span
                      className="rounded border border-border bg-muted/50 px-1.5 py-px font-mono text-[10px] text-muted-foreground"
                      title={s.projectName ?? undefined}
                    >
                      {s.projectSlug}
                    </span>
                  )}
                </div>
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
              {/* Status chip — chỉ hiển thị "active" khi có version đã approve
                  (currentVersionId != null). Khi chưa có version active → "pending"
                  để user không nhầm là skill đã được publish. */}
              {(() => {
                const effective = s.currentVersionId == null ? 'pending' : s.status;
                const isReady = effective === 'active';
                return (
                  <span
                    className={`shrink-0 rounded border px-2 py-px text-[11px] font-medium ${
                      isReady
                        ? 'border-transparent bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                        : effective === 'pending'
                          ? 'border-transparent bg-amber-500/12 text-amber-600 dark:text-amber-400'
                          : 'border-border bg-muted text-muted-foreground'
                    }`}
                    title={
                      effective === 'pending'
                        ? 'Chưa có version nào được approve — skill không tải được'
                        : undefined
                    }
                  >
                    {effective}
                  </span>
                );
              })()}
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
