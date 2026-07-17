'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ApiError } from '../../lib/api-client';
import { SearchHit, search } from '../../lib/api/search';

type Kind = 'all' | 'skill' | 'artifact';

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query.length < 2) return;
    setBusy(true);
    setError(null);
    setSubmitted(true);
    try {
      const r = await search({ q: query, kind });
      setHits(r);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
    } finally {
      setBusy(false);
    }
  }

  function hitLink(h: SearchHit): string {
    return h.kind === 'skill' ? `/skills/${encodeURIComponent(h.name)}` : `/artifacts/${h.id}`;
  }

  // ts_headline emits <b>...</b> around matches. Render safe với dangerouslySetInnerHTML
  // vì server-controlled (backend gen từ tsvector). Chỉ chấp nhận <b>/<i> — v1 pilot ok.
  function renderSnippet(s: string): { __html: string } {
    // Strip non-<b>/<i> tags để safe (paranoid).
    const cleaned = s.replace(/<(?!\/?(?:b|i)\b)[^>]*>/gi, '');
    return { __html: cleaned };
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold">Search</h1>
      <p className="mt-1 text-sm text-slate-500">
        Full-text search qua skills + artifacts đã published trong dept. Bỏ dấu OK.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Vd: payment webhook timeout, kibana correlate..."
          className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          autoFocus
        />
        <div className="flex gap-1">
          {(['all', 'skill', 'artifact'] as Kind[]).map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => setKind(k)}
              className={`rounded px-2 py-1 text-xs ${
                k === kind
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={busy || q.trim().length < 2}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          {error}
        </div>
      )}

      {submitted && !busy && hits.length === 0 && !error && (
        <p className="mt-8 rounded border border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-800">
          No results.
        </p>
      )}

      {hits.length > 0 && (
        <ul className="mt-8 space-y-4">
          {hits.map((h, i) => (
            <li
              key={`${h.kind}-${h.id}`}
              className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-baseline gap-2">
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {h.kind}
                </span>
                <Link href={hitLink(h)} className="text-lg font-semibold text-blue-600 hover:underline">
                  {h.name}
                </Link>
                <span className="ml-auto font-mono text-xs text-slate-400">rank {h.rank.toFixed(2)}</span>
              </div>
              <p
                className="mt-2 text-sm text-slate-700 dark:text-slate-300 [&_b]:bg-yellow-100 [&_b]:font-semibold dark:[&_b]:bg-yellow-900/50"
                dangerouslySetInnerHTML={renderSnippet(h.snippet)}
              />
              {h.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {h.tags.map((t) => (
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
      )}
    </main>
  );
}
