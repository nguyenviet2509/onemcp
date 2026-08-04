'use client';

import { useTranslations } from 'next-intl';

// Controlled pagination component — minimal Option A style.
// Client-side only: no SSR query param sync (acceptable for v1 pilot scale).
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

interface PaginationProps {
  page: number;           // 1-based current page
  pageSize: PageSize;
  total: number;          // total number of items
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const t = useTranslations('pagination');
  const tSearch = useTranslations('pages.search');

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-[13px] text-muted-foreground">
      {/* Left: count summary */}
      <span className="shrink-0">
        {total === 0 ? tSearch('resultsCount', { count: 0 }) : `${from}–${to} / ${total}`}
      </span>

      {/* Right cluster: prev/next + rows-per-page */}
      <div className="flex items-center gap-4">
        {/* Page navigation */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={!hasPrev}
            className="rounded px-2 py-0.5 transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            aria-label={t('previous')}
          >
            {t('previous')}
          </button>
          <span className="tabular-nums">
            {t('pageOf', { page, total: totalPages })}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={!hasNext}
            className="rounded px-2 py-0.5 transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            aria-label={t('next')}
          >
            {t('next')}
          </button>
        </div>

        {/* Rows per page */}
        <label className="flex items-center gap-1.5 shrink-0">
          <span>{t('rowsPerPage')}:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
            className="h-7 rounded-md border border-input bg-transparent px-1.5 text-[13px] text-foreground focus:outline-none focus-visible:border-foreground focus-visible:ring-3 focus-visible:ring-ring/15"
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

// Helper: compute the slice for client-side pagination.
// NOTE: API does not yet support page/limit params — client slices the full fetch.
// Trade-off: fetches all items on every filter change; acceptable at pilot scale (<200 artifacts).
export function paginateItems<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
