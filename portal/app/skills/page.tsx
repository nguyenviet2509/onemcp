'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../lib/api-client';
import { listSkills, Skill } from '../../lib/api/skills';

export default function SkillsListPage() {
  const [items, setItems] = useState<Skill[]>([]);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      if (!q) return true;
      return s.name.includes(q) || (s.description ?? '').toLowerCase().includes(q);
    });
  }, [items, query, tag]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((s) => s.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [items]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Skills</h1>
        <span className="text-sm text-muted-foreground">{items.length} skill(s)</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or description..."
          className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setTag(null)}
              className={`rounded px-2 py-1 text-xs ${
                tag === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              all
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => setTag(t === tag ? null : t)}
                className={`rounded px-2 py-1 text-xs ${
                  t === tag
                    ? 'bg-blue-600 text-white'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <p className="mt-6 text-muted-foreground">Loading...</p>}
      {error && (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="mt-8 rounded border border-border p-8 text-center text-muted-foreground">
          <p className="font-medium">Chưa có skill nào phù hợp filter.</p>
          <p className="mt-1 text-xs">
            Skills được sync tự động từ GitLab qua webhook (P2 part 2). Hoặc admin có thể seed thủ công.
          </p>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {filtered.map((s) => (
          <li
            key={s.id}
            className="rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <Link
                  href={`/skills/${encodeURIComponent(s.name)}`}
                  className="text-lg font-semibold text-primary hover:underline"
                >
                  {s.name}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {s.description ?? <em className="text-muted-foreground/60">no description</em>}
                </p>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  s.status === 'active'
                    ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-100'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {s.status}
              </span>
            </div>
            {s.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {s.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground"
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
