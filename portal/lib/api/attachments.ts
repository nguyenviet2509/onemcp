import { apiFetch, getAccessToken } from '../api-client';

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

// Multipart cần bỏ Content-Type để browser tự set boundary — không dùng apiFetch được.
// OIDC mode: gắn Bearer từ NextAuth session. IAP mode: token null → cookie path.
export async function uploadAttachment(artifactId: string, file: File): Promise<Attachment> {
  const form = new FormData();
  form.append('file', file);
  const headers = new Headers();
  const token = await getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`/api/artifacts/${encodeURIComponent(artifactId)}/attachments`, {
    method: 'POST',
    body: form,
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return (await res.json()) as Attachment;
}

// Download qua fetch+blob (thay vì <a href>) — anchor navigation không mang Bearer
// header, sẽ fail trong OIDC mode. Trả blob URL để component tạo link download động.
export async function downloadAttachmentBlob(id: string): Promise<Blob> {
  const headers = new Headers();
  const token = await getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`/api/attachments/${encodeURIComponent(id)}/download`, {
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.blob();
}

export function deleteAttachment(id: string) {
  return apiFetch<void>(`/attachments/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
