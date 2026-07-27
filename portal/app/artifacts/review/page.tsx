'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError } from '../../../lib/api-client';
import { Artifact, listArtifacts } from '../../../lib/api/artifacts';
import { Badge } from '../../../components/ui/badge';
import { statusVariant } from '../../../lib/status-pill-variants';

// Queue cho maintainer — chỉ show pending artifacts.
// Non-maintainer sẽ chỉ thấy own pending (backend RBAC).
export default function ArtifactReviewQueuePage() {
  const [items, setItems] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listArtifacts({ status: 'pending' })
      .then(setItems)
      .catch((e) => setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="text-sm">
        <Link href="/artifacts" className="text-blue-600 hover:underline">
          ← All artifacts
        </Link>
      </div>
      <h1 className="mt-4 text-2xl font-bold">Review queue</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Artifacts đang chờ approve. Click để xem chi tiết + approve/reject.
      </p>

      {loading && <p className="mt-6 text-muted-foreground">Loading...</p>}
      {error && (
        <div className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          {error}
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="mt-8 rounded border border-border p-8 text-center text-muted-foreground">
          Queue trống. Không có pending artifact nào.
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {items.map((a) => (
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
                    className="text-base font-semibold text-primary hover:underline"
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
    </main>
  );
}
