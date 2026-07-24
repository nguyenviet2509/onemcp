import { apiFetch } from '../api-client';

export type ArtifactType = 'report' | 'research' | 'kb' | 'postmortem' | 'runbook';
export type ArtifactStatus = 'pending' | 'published' | 'rejected' | 'archived';
export type ArtifactVersionStatus = 'pending' | 'active' | 'rejected';

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  slug: string;
  departmentId: number;
  ownerId: number;
  currentVersionId: string | null;
  status: ArtifactStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactVersion {
  id: string;
  artifactId: string;
  versionNo: number;
  authorId: number;
  body: string;
  structured: Record<string, unknown>;
  status: ArtifactVersionStatus;
  submittedAt: string;
  reviewedBy: number | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface ArtifactDetail {
  artifact: Artifact;
  version: ArtifactVersion | null;
}

export interface SubmitArtifactPayload {
  type: ArtifactType;
  title: string;
  slug: string;
  body?: string;
  structured?: Record<string, unknown>;
  tags?: string[];
}

export interface ListArtifactsParams {
  type?: ArtifactType;
  tag?: string;
  q?: string;
  status?: ArtifactStatus;
  // Phase 3 extended filter params
  space?: string;
  templateKey?: string;
  author?: number;
  dateFrom?: string;  // ISO date string
  dateTo?: string;    // ISO date string
}

export function listArtifacts(params: ListArtifactsParams = {}) {
  const qs = new URLSearchParams();
  if (params.type) qs.set('type', params.type);
  if (params.tag) qs.set('tag', params.tag);
  if (params.q) qs.set('q', params.q);
  if (params.status) qs.set('status', params.status);
  if (params.space) qs.set('space', params.space);
  if (params.templateKey) qs.set('template_key', params.templateKey);
  if (params.author != null) qs.set('author', String(params.author));
  if (params.dateFrom) qs.set('date_from', params.dateFrom);
  if (params.dateTo) qs.set('date_to', params.dateTo);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<Artifact[]>(`/artifacts${suffix}`);
}

export function getArtifact(id: string) {
  return apiFetch<ArtifactDetail>(`/artifacts/${encodeURIComponent(id)}`);
}

export function listArtifactVersions(id: string) {
  return apiFetch<ArtifactVersion[]>(`/artifacts/${encodeURIComponent(id)}/versions`);
}

export function submitArtifact(payload: SubmitArtifactPayload) {
  return apiFetch<ArtifactDetail>(`/artifacts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface UpdateArtifactPayload {
  expected_version_no: number;
  body?: string;
  structured?: Record<string, unknown>;
  tags?: string[];
}

export function updateArtifact(id: string, payload: UpdateArtifactPayload) {
  return apiFetch<ArtifactDetail>(`/artifacts/${encodeURIComponent(id)}/versions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function reviewArtifact(id: string, action: 'approve' | 'reject', note?: string) {
  return apiFetch<Artifact>(`/artifacts/${encodeURIComponent(id)}/review`, {
    method: 'POST',
    body: JSON.stringify({ action, note }),
  });
}
