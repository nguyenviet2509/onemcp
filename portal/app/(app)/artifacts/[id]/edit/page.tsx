'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { StructuredEditor } from '@/components/structured-editor';
import { ApiError } from '@/lib/api-client';
import { ArtifactType, getArtifact, updateArtifact } from '@/lib/api/artifacts';
import { getTemplate, Template } from '@/lib/api/templates';

interface Props {
  params: Promise<{ id: string }>;
}

// Normalize backend 'structured' payload → flat {fieldKey: value}.
// Backend supports 2 shapes (see template-validator.validate): nested
// {template_version, fields:{key: val}} OR flat {key: val}. Read either.
function extractFields(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  if (obj.fields && typeof obj.fields === 'object') {
    return { ...(obj.fields as Record<string, string>) };
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'template_version') continue;
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

// Option A edit page: token-only styles, inverted primary submit btn.
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
  const t = useTranslations('pages.artifactsEdit');
  const tCommon = useTranslations('common');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getArtifact(id)
      .then(async (d) => {
        setTitle(d.artifact.title);
        setType(d.artifact.type);
        setTags(d.artifact.tags.join(', '));
        setExpectedVersion(d.version?.versionNo ?? 0);
        setFields(extractFields(d.version?.structured));
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
    <main className="mx-auto max-w-3xl px-8 py-6">
      {/* Breadcrumb */}
      <div className="mb-4 text-xs text-muted-foreground">
        <Link href={`/artifacts/${id}`} className="hover:text-foreground transition-colors">
          ← {tCommon('back')}
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t('title', { title: title || '…' })}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t('note')} (type={type})
        </p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>}

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && expectedVersion !== null && template && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {t('editingOn', { version: expectedVersion })}
          </p>

          <div>
            <label className="mb-1 block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t('tagsLabel')}
            </label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-transparent px-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-3 focus:ring-ring/15 focus:border-foreground"
            />
          </div>

          <StructuredEditor
            template={template}
            values={fields}
            onChange={(k, v) => setFields((prev) => ({ ...prev, [k]: v }))}
          />

          <div className="flex items-center gap-3 pt-2">
            {/* Option A primary: inverted bg=foreground, text=background */}
            <button
              type="submit"
              disabled={busy}
              className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {busy ? tCommon('saving') : t('submitNewVersion')}
            </button>
            <Link
              href={`/artifacts/${id}`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {tCommon('cancel')}
            </Link>
          </div>
        </form>
      )}
    </main>
  );
}
