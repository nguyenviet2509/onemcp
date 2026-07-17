'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { StructuredEditor } from '../../../../components/structured-editor';
import { ApiError } from '../../../../lib/api-client';
import { ArtifactType, getArtifact, updateArtifact } from '../../../../lib/api/artifacts';
import { getTemplate, Template } from '../../../../lib/api/templates';

interface Props {
  params: Promise<{ id: string }>;
}

interface StructuredShape {
  template_version?: number;
  fields?: Record<string, string>;
}

export default function EditArtifactPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ArtifactType>('kb');
  const [template, setTemplate] = useState<Template | null>(null);
  const [tags, setTags] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [expectedVersion, setExpectedVersion] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getArtifact(id)
      .then(async (d) => {
        setTitle(d.artifact.title);
        setType(d.artifact.type);
        setTags(d.artifact.tags.join(', '));
        setExpectedVersion(d.version?.versionNo ?? 0);
        const structured = (d.version?.structured ?? {}) as StructuredShape;
        setFields(structured.fields ?? {});
        const t = await getTemplate(d.artifact.type);
        setTemplate(t);
      })
      .catch((e) => setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (expectedVersion === null) return;
    setBusy(true);
    setError(null);
    try {
      await updateArtifact(id, {
        expected_version_no: expectedVersion,
        structured: fields,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      router.push(`/artifacts/${id}`);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="text-sm">
        <Link href={`/artifacts/${id}`} className="text-blue-600 hover:underline">
          ← Back to detail
        </Link>
      </div>
      <h1 className="mt-4 text-2xl font-bold">Edit: {title || '...'}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Update sẽ tạo pending version mới (type={type}). Maintainer approve để publish.
      </p>

      {loading && <p className="mt-6 text-slate-500">Loading...</p>}
      {error && (
        <div className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          {error}
        </div>
      )}

      {!loading && expectedVersion !== null && template && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <p className="text-xs text-slate-500">
            Editing on top of version <code>{expectedVersion}</code>. Concurrent submit → 409 conflict.
          </p>

          <div>
            <label className="mb-1 block text-sm font-medium">Tags (comma-separated)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <StructuredEditor
            template={template}
            values={fields}
            onChange={(k, v) => setFields((prev) => ({ ...prev, [k]: v }))}
          />

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Saving...' : 'Submit new version'}
            </button>
            <Link href={`/artifacts/${id}`} className="text-sm text-slate-500 hover:underline">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </main>
  );
}
