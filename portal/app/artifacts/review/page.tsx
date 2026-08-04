'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError } from '../../../lib/api-client';
import { Artifact, listArtifacts } from '../../../lib/api/artifacts';
import { Badge } from '../../../components/ui/badge';
import { statusVariant } from '../../../lib/status-pill-variants';
import { Pagination, paginateItems } from '../../../components/pagination';

// Queue cho maintainer — chỉ show pending artifacts.
// Non-maintainer sẽ chỉ thấy own pending (backend RBAC).
export default function ArtifactReviewQueuePage() {
  const [items, setItems] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<20 | 10 | 50 | 100>(20);

  useEffect(() => {
    setLoading(true);
    listArtifacts({ status: 'pending' })
      .then(setItems)
      .catch((e) => setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const pagedItems = paginateItems(items, page, pageSize);

  return (
    <main className="mx-auto max-w-4xl px-6 py-6">
      <div className="text-sm">
        <Link href="/artifacts" className="text-primary hover:underline">
          ← All artifacts
        </Link>
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">Review queue</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Artifacts đang chờ approve. Click để xem chi tiết + approve/reject.
      </p>

      {loading && <p className="mt-6 text-muted-foreground">Loading...</p>}
      {error && (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="mt-8 rounded border border-border p-8 text-center text-muted-foreground">
          Queue trống. Không có pending artifact nào.
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {pagedItems.map((a) => (
          <li
            key={a.id}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="template" className="font-mono">{a.type}</Badge>
                  <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                  <Link
                    href={`/artifacts/${a.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {a.title}
                  </Link>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {a.slug} · owner #{a.ownerId} · created {new Date(a.createdAt).toLocaleString()}
                </p>
              </div>
              <Link
                href={`/artifacts/${a.id}`}
                className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Review
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {!loading && !error && items.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={items.length}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      )}
    </main>
  );
}
