'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { buttonVariants } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Skeleton } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { PageShell } from '../../components/page-shell';
import { EmptyState } from '../../components/empty-state';
import { ArtifactFilterPanel, FilterState } from '../../components/artifact-filter-panel';
import { ArtifactBulkActions } from '../../components/artifact-bulk-actions';
import { Artifact, ArtifactStatus, deleteArtifact, listArtifacts } from '../../lib/api/artifacts';
import { statusVariant } from '../../lib/status-pill-variants';
import { Pagination, paginateItems } from '../../components/pagination';

function filterToParams(f: FilterState) {
  return {
    space: f.space || undefined,
    templateKey: f.templateKey || undefined,
    tag: f.tags.split(',').map((t) => t.trim()).find(Boolean),
    status: (f.status as ArtifactStatus) || undefined,
    author: f.author === 'me' ? ('me' as const) : f.author ? Number(f.author) : undefined,
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
  };
}

// Option A artifact row: flat divide-y layout, no card-per-row shadow.
// Row-end fast actions: Edit link + Delete button (revealed on hover for
// discoverability; visible on touch via focus-within fallback).
function ArtifactRow({
  artifact,
  checked,
  onToggle,
  onDeleted,
}: {
  artifact: Artifact;
  checked: boolean;
  onToggle: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm(`Xóa artifact "${artifact.title}"? Không thể undo.`)) return;
    try {
      await deleteArtifact(artifact.id);
      onDeleted(artifact.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  }
  return (
    <li className="group flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
      <Checkbox
        checked={checked}
        onCheckedChange={() => onToggle(artifact.id)}
        aria-label={`Select "${artifact.title}"`}
        className="mt-0.5 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/artifacts/${artifact.id}`}
            className="truncate text-sm font-medium text-foreground hover:text-primary"
          >
            {artifact.title}
          </Link>
          <Badge variant={statusVariant(artifact.status)}>{artifact.status}</Badge>
          {artifact.type && (
            <Badge variant="template">{artifact.type}</Badge>
          )}
        </div>
        {artifact.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {artifact.tags.map((t) => (
              <Badge key={t} variant="tag">{t}</Badge>
            ))}
          </div>
        )}
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{artifact.slug}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <Link
          href={`/artifacts/${artifact.id}/edit`}
          className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function LoadingRows() {
  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-4 py-3">
          <Skeleton className="mb-2 h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function ArtifactsContent() {
  const [items, setItems] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastFilter, setLastFilter] = useState<FilterState | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<20 | 10 | 50 | 100>(20);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const fetchList = useCallback((f: FilterState) => {
    setLastFilter(f);
    setLoading(true);
    setError(null);
    setPage(1); // reset to first page on new filter
    listArtifacts(filterToParams(f))
      .then((data) => {
        setItems(data);
        setSelectedIds(new Set());
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((a) => a.id)));
    }
  }

  // Sort theo updatedAt; sortOrder đổi hướng. Sort trước rồi mới phân trang
  // để page 1 luôn là bản mới/cũ nhất tuỳ chọn của user.
  const sortedItems = [...items].sort((a, b) => {
    const ta = new Date(a.updatedAt).getTime();
    const tb = new Date(b.updatedAt).getTime();
    return sortOrder === 'newest' ? tb - ta : ta - tb;
  });
  const pagedItems = paginateItems(sortedItems, page, pageSize);
  const allChecked = items.length > 0 && selectedIds.size === items.length;
  const someChecked = selectedIds.size > 0 && !allChecked;

  return (
    <>
      <ArtifactFilterPanel onChange={fetchList} />

      <div className="mt-4">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <LoadingRows />
        ) : items.length === 0 ? (
          <EmptyState
            title="No artifacts found"
            description="Try adjusting your filters or submit a new artifact."
            cta={
              <Link href="/artifacts/new" className={buttonVariants({ size: 'sm' })}>
                Submit artifact
              </Link>
            }
          />
        ) : (
          <>
            {/* Select-all header + sort */}
            <div className="mb-2 flex items-center gap-3 px-1">
              <Checkbox
                checked={allChecked}
                indeterminate={someChecked}
                onCheckedChange={toggleAll}
                aria-label="Select all artifacts"
              />
              <span className="text-xs text-muted-foreground">
                {items.length} artifact{items.length !== 1 ? 's' : ''}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <label htmlFor="artifact-sort" className="text-xs text-muted-foreground">
                  Sort:
                </label>
                <select
                  id="artifact-sort"
                  value={sortOrder}
                  onChange={(e) => {
                    setSortOrder(e.target.value as 'newest' | 'oldest');
                    setPage(1);
                  }}
                  className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="newest">Mới nhất</option>
                  <option value="oldest">Cũ nhất</option>
                </select>
              </div>
            </div>

            {/* Artifact list — Option A: divide-y, no per-row card */}
            <ul className="divide-y divide-border rounded-lg border border-border">
              {pagedItems.map((a) => (
                <ArtifactRow
                  key={a.id}
                  artifact={a}
                  checked={selectedIds.has(a.id)}
                  onToggle={toggleOne}
                  onDeleted={(id) => setItems((prev) => prev.filter((x) => x.id !== id))}
                />
              ))}
            </ul>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={items.length}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </>
        )}
      </div>

      <ArtifactBulkActions
        selectedIds={selectedIds}
        allArtifacts={items}
        onComplete={() => lastFilter && fetchList(lastFilter)}
      />
    </>
  );
}

export default function ArtifactsListPage() {
  return (
    <PageShell
      title="Artifacts"
      breadcrumb={[{ label: 'Artifacts' }]}
      actions={
        <Link href="/artifacts/new" className={buttonVariants({ size: 'sm' })}>
          Submit new
        </Link>
      }
    >
      <Suspense fallback={<LoadingRows />}>
        <ArtifactsContent />
      </Suspense>
    </PageShell>
  );
}
