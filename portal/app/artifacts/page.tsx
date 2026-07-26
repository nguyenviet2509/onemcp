'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { buttonVariants } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Skeleton } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Separator } from '../../components/ui/separator';
import { PageShell } from '../../components/page-shell';
import { EmptyState } from '../../components/empty-state';
import { ArtifactFilterPanel, FilterState } from '../../components/artifact-filter-panel';
import { ArtifactBulkActions } from '../../components/artifact-bulk-actions';
import { Artifact, ArtifactStatus, listArtifacts } from '../../lib/api/artifacts';
import { FileTextIcon } from 'lucide-react';

// Status badge color map — text-only labels, no extra icons.
const STATUS_CLASSES: Record<ArtifactStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100',
  published: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-100',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-100',
  archived: 'bg-secondary text-secondary-foreground',
};

// Builds ListArtifactsParams from FilterState (adapter layer).
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

function ArtifactRow({
  artifact,
  checked,
  onToggle,
}: {
  artifact: Artifact;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40">
      <Checkbox
        checked={checked}
        onCheckedChange={() => onToggle(artifact.id)}
        aria-label={`Select "${artifact.title}"`}
        className="mt-0.5 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {artifact.type}
          </span>
          <Link
            href={`/artifacts/${artifact.id}`}
            className="truncate text-sm font-semibold text-primary hover:underline"
          >
            {artifact.title}
          </Link>
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[artifact.status]}`}
          >
            {artifact.status}
          </span>
        </div>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{artifact.slug}</p>
        {artifact.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {artifact.tags.map((t) => (
              <Badge key={t} variant="outline" className="text-xs">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function LoadingRows() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="rounded-lg border border-border bg-card px-4 py-3">
          <Skeleton className="mb-2 h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </li>
      ))}
    </ul>
  );
}

// Inner component that requires useSearchParams — wrapped in Suspense below.
function ArtifactsContent() {
  const [items, setItems] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastFilter, setLastFilter] = useState<FilterState | null>(null);

  const fetchList = useCallback((f: FilterState) => {
    setLastFilter(f);
    setLoading(true);
    setError(null);
    listArtifacts(filterToParams(f))
      .then((data) => {
        setItems(data);
        setSelectedIds(new Set()); // reset selection on filter change
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  // Checkbox toggle helpers.
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

  const allChecked = items.length > 0 && selectedIds.size === items.length;
  const someChecked = selectedIds.size > 0 && !allChecked;

  return (
    <>
      {/* Filter panel — syncs to URL + calls fetchList on change */}
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
            icon={<FileTextIcon className="size-8" />}
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
            {/* Select-all header row */}
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
            </div>
            <Separator className="mb-3" />

            <ul className="space-y-2">
              {items.map((a) => (
                <ArtifactRow
                  key={a.id}
                  artifact={a}
                  checked={selectedIds.has(a.id)}
                  onToggle={toggleOne}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Sticky bulk actions bar — only visible when items selected */}
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
      {/* Suspense boundary required because ArtifactFilterPanel uses useSearchParams */}
      <Suspense fallback={<LoadingRows />}>
        <ArtifactsContent />
      </Suspense>
    </PageShell>
  );
}
