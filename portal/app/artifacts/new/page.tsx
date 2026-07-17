'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError } from '../../../lib/api-client';
import { ArtifactType, submitArtifact } from '../../../lib/api/artifacts';

const TYPES: ArtifactType[] = ['report', 'research', 'kb'];

// Simple textarea editor v1 — Tiptap/section-builder defer.
export default function NewArtifactPage() {
  const router = useRouter();
  const [type, setType] = useState<ArtifactType>('report');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await submitArtifact({
        type,
        title: title.trim(),
        slug: slug.trim().toLowerCase(),
        body,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      router.push(`/artifacts/${result.artifact.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="text-sm">
        <Link href="/artifacts" className="text-blue-600 hover:underline">
          ← All artifacts
        </Link>
      </div>
      <h1 className="mt-4 text-2xl font-bold">Submit new artifact</h1>
      <p className="mt-1 text-sm text-slate-500">
        Sau khi submit sẽ ở trạng thái <code>pending</code>. Maintainer sẽ approve để publish.
      </p>

      {error && (
        <div className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Type</label>
          <div className="flex gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded px-3 py-1 text-sm ${
                  t === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            maxLength={255}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Slug (URL-friendly)</label>
          <input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder="e.g. postmortem-payment-2026-q3"
            pattern="[a-z0-9][a-z0-9-]*"
            maxLength={160}
          />
          <p className="mt-1 text-xs text-slate-500">lowercase + dashes only</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Tags (comma-separated)</label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder="postmortem, payment, sepay"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Body (markdown)</label>
          <textarea
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder={'# Summary\n\n...\n\n## Root cause\n\n...\n\n## Fix\n\n...'}
          />
          <p className="mt-1 text-xs text-slate-500">Max 2MB.</p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={busy || !title.trim() || !slug.trim() || !body.trim()}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Submitting...' : 'Submit for review'}
          </button>
          <Link href="/artifacts" className="text-sm text-slate-500 hover:underline">
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
