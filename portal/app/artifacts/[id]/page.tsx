'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { ApiError } from '../../../lib/api-client';
import { ArtifactDetail, getArtifact, reviewArtifact } from '../../../lib/api/artifacts';

interface Props {
  params: Promise<{ id: string }>;
}

export default function ArtifactDetailPage({ params }: Props) {
  const { id } = use(params);
  const [detail, setDetail] = useState<ArtifactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = () =>
    getArtifact(id)
      .then(setDetail)
      .catch((e) => setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e)));

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleReview(action: 'approve' | 'reject') {
    setBusy(true);
    setError(null);
    try {
      await reviewArtifact(id, action, note || undefined);
      setNote('');
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="text-sm">
        <Link href="/artifacts" className="text-blue-600 hover:underline">
          ← All artifacts
        </Link>
      </div>

      {loading && <p className="mt-6 text-slate-500">Loading...</p>}
      {error && (
        <div className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          {error}
        </div>
      )}

      {detail && (
        <>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {detail.artifact.type}
            </span>
            <h1 className="text-2xl font-bold">{detail.artifact.title}</h1>
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                detail.artifact.status === 'published'
                  ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-100'
                  : detail.artifact.status === 'rejected'
                    ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-100'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100'
              }`}
            >
              {detail.artifact.status}
            </span>
          </div>

          <div className="mt-2 text-sm text-slate-500">
            slug: <code className="font-mono">{detail.artifact.slug}</code>
            {detail.version && (
              <>
                {' '}
                · v{detail.version.versionNo} ({detail.version.status}) · submitted{' '}
                {new Date(detail.version.submittedAt).toLocaleString()}
              </>
            )}
          </div>

          {detail.artifact.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {detail.artifact.tags.map((t) => (
                <span
                  key={t}
                  className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {detail.version && (
            <article className="mt-6 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <pre className="whitespace-pre-wrap font-mono text-sm text-slate-800 dark:text-slate-200">
                {detail.version.body}
              </pre>
            </article>
          )}

          {detail.version?.status === 'pending' && (
            <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
              <h2 className="text-sm font-semibold">Review actions (maintainer only)</h2>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Ghi chú (optional)..."
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                maxLength={1000}
              />
              <div className="mt-2 flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => handleReview('approve')}
                  className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  disabled={busy}
                  onClick={() => handleReview('reject')}
                  className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Backend enforce role — contributor sẽ nhận 403.
              </p>
            </section>
          )}

          {detail.version?.reviewedAt && (
            <p className="mt-3 text-xs text-slate-500">
              Reviewed {new Date(detail.version.reviewedAt).toLocaleString()} — {detail.version.status}
              {detail.version.reviewNote && ` · note: ${detail.version.reviewNote}`}
            </p>
          )}
        </>
      )}
    </main>
  );
}
