import { apiFetch } from '../api-client';

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
// credentials: 'include' ensures oauth2-proxy session cookie travels with the request.
export async function uploadAttachment(artifactId: string, file: File): Promise<Attachment> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`/api/artifacts/${encodeURIComponent(artifactId)}/attachments`, {
    method: 'POST',
    body: form,
    credentials: 'include',
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
