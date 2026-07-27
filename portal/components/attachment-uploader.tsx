'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Attachment,
  deleteAttachment,
  downloadAttachmentUrl,
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
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Xóa attachment?')) return;
    try {
      await deleteAttachment(id);
      setItems((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Attachments ({items.length})</h2>
        {canWrite && (
          <label className="cursor-pointer rounded border border-foreground bg-foreground px-3 py-1 text-xs text-background hover:opacity-90 transition-opacity">
            {busy ? 'Uploading...' : '+ Upload'}
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
        <p className="mt-3 text-xs text-muted-foreground">Chưa có attachment nào.</p>
      ) : (
        <ul className="mt-3 space-y-1 text-sm">
          {items.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-muted">
              <a
                href={downloadAttachmentUrl(a.id)}
                className="flex-1 truncate text-primary hover:underline"
                download={a.filename}
              >
                {a.filename}
              </a>
              <span className="ml-3 font-mono text-xs text-muted-foreground">
                {a.contentType} · {humanSize(Number(a.sizeBytes))}
              </span>
              {canWrite && (
                <button
                  onClick={() => handleDelete(a.id)}
                  className="ml-3 text-xs text-destructive hover:underline"
                >
                  delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Allowed: pdf, md, txt, png, jpg, docx · max 100MB
      </p>
    </section>
  );
}
