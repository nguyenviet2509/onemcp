'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  Attachment,
  deleteAttachment,
  downloadAttachmentBlob,
  listAttachments,
  uploadAttachment,
} from '../lib/api/attachments';

interface Props {
  artifactId: string;
  canWrite?: boolean;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentUploader({ artifactId, canWrite = true }: Props) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations('attachments');

  useEffect(() => {
    listAttachments(artifactId)
      .then(setItems)
      .catch((e) => setError(String(e)));
  }, [artifactId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const att = await uploadAttachment(artifactId, file);
      setItems((prev) => [att, ...prev]);
      toast.success(t('uploadedToast', { name: att.filename }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDownload(a: Attachment) {
    try {
      const blob = await downloadAttachmentBlob(a.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = a.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    try {
      await deleteAttachment(id);
      setItems((prev) => prev.filter((a) => a.id !== id));
      toast.success(t('deletedToast'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t('title', { count: items.length })}</h2>
        {canWrite && (
          <label className="cursor-pointer rounded border border-foreground bg-foreground px-3 py-1 text-xs text-background hover:opacity-90 transition-opacity">
            {busy ? t('uploading') : t('upload')}
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              disabled={busy}
              accept=".pdf,.md,.txt,.png,.jpg,.jpeg,.docx"
            />
          </label>
        )}
      </div>
      {error && (
        <p className="mt-2 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="mt-3 space-y-1 text-sm">
          {items.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-muted">
              <button
                type="button"
                onClick={() => handleDownload(a)}
                className="flex-1 truncate text-left text-primary hover:underline"
              >
                {a.filename}
              </button>
              <span className="ml-3 font-mono text-xs text-muted-foreground">
                {a.contentType} · {humanSize(Number(a.sizeBytes))}
              </span>
              {canWrite && (
                <button
                  onClick={() => handleDelete(a.id)}
                  className="ml-3 text-xs text-destructive hover:underline"
                >
                  {t('delete')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {t('allowed')}
      </p>
    </section>
  );
}
