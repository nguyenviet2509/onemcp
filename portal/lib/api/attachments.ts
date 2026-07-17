import { apiFetch } from '../api-client';
import { getIdentity } from '../identity';

export interface Attachment {
  id: string;
  artifactId: string;
  filename: string;
  contentType: string;
  sizeBytes: string;
  checksumSha256: string;
  storageKey: string;
  uploadedBy: number;
  uploadedAt: string;
}

export function listAttachments(artifactId: string) {
  return apiFetch<Attachment[]>(`/artifacts/${encodeURIComponent(artifactId)}/attachments`);
}

// Custom fetch — multipart cần bỏ Content-Type để browser tự set boundary.
export async function uploadAttachment(artifactId: string, file: File): Promise<Attachment> {
  const form = new FormData();
  form.append('file', file);
  const headers = new Headers();
  const identity = getIdentity();
  if (identity) headers.set('X-Onemcp-User', identity);
  const res = await fetch(`/api/artifacts/${encodeURIComponent(artifactId)}/attachments`, {
    method: 'POST',
    body: form,
    headers,
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return (await res.json()) as Attachment;
}

export function downloadAttachmentUrl(id: string): string {
  return `/api/attachments/${encodeURIComponent(id)}/download`;
}

export function deleteAttachment(id: string) {
  return apiFetch<void>(`/attachments/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
