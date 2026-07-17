'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError } from '../../../lib/api-client';
import { Artifact, listArtifacts } from '../../../lib/api/artifacts';

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
      <p className="mt-1 text-sm text-slate-500">
        Artifacts đang chờ approve. Click để xem chi tiết + approve/reject.
      </p>

      {loading && <p className="mt-6 text-slate-500">Loading...</p>}
      {error && (
        <div className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          {error}
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="mt-8 rounded border border-slate-200 p-8 text-center text-slate-500 dark:border-slate-800">
          Queue trống. Không có pending artifact nào.
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {items.map((a) => (
          <li
            key={a.id}
            className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {a.type}
                  </span>
                  <Link
                    href={`/artifacts/${a.id}`}
                    className="text-lg font-semibold text-blue-600 hover:underline"
                  >
                    {a.title}
                  </Link>
                </div>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  {a.slug} · owner #{a.ownerId} · created {new Date(a.createdAt).toLocaleString()}
                </p>
              </div>
              <Link
                href={`/artifacts/${a.id}`}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
              >
                Review →
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
