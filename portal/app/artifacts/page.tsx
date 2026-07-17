'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../lib/api-client';
import { Artifact, ArtifactType, listArtifacts } from '../../lib/api/artifacts';

const TYPES: (ArtifactType | 'all')[] = ['all', 'report', 'research', 'kb'];

export default function ArtifactsListPage() {
  const [items, setItems] = useState<Artifact[]>([]);
  const [type, setType] = useState<ArtifactType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listArtifacts({ type: type === 'all' ? undefined : type })
      .then(setItems)
      .catch((e) => setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e)))
      .finally(() => setLoading(false));
  }, [type]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((a) => a.title.toLowerCase().includes(q) || a.slug.includes(q));
  }, [items, query]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Artifacts</h1>
        <Link
          href="/artifacts/new"
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          + Submit
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title / slug..."
          className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <div className="flex flex-wrap gap-1">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded px-2 py-1 text-xs ${
                t === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <Link href="/artifacts/review" className="text-xs text-slate-500 hover:underline">
          → Review queue
        </Link>
      </div>

      {loading && <p className="mt-6 text-slate-500">Loading...</p>}
      {error && (
        <div className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          {error}
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="mt-8 rounded border border-slate-200 p-8 text-center text-slate-500 dark:border-slate-800">
          Chưa có artifact. <Link href="/artifacts/new" className="text-blue-600 hover:underline">Submit đầu tiên</Link>.
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {filtered.map((a) => (
          <li
            key={a.id}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-500 dark:border-slate-800 dark:bg-slate-900"
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
                <p className="mt-1 font-mono text-xs text-slate-500">{a.slug}</p>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  a.status === 'published'
                    ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-100'
                    : a.status === 'rejected'
                      ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-100'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100'
                }`}
              >
                {a.status}
              </span>
            </div>
            {a.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {a.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
