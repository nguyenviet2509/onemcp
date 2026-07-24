import { apiFetch } from '../api-client';

// Space — multi-department knowledge space (Phase 1 backend).
export interface Space {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  deptId: number | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpacePayload {
  slug: string;
  name: string;
  description?: string;
  deptId?: number;
  isPublic?: boolean;
}

export interface UpdateSpacePayload {
  name?: string;
  description?: string;
  isPublic?: boolean;
}

export function listSpaces() {
  return apiFetch<Space[]>('/spaces');
}

export function getSpace(slug: string) {
  return apiFetch<Space>(`/spaces/${encodeURIComponent(slug)}`);
}

export function listSpacesByDept(deptId: number) {
  return apiFetch<Space[]>(`/spaces?dept=${encodeURIComponent(deptId)}`);
}

// Admin: requires CIDR-gated role — server returns 403 if not authorized.
export function createSpace(payload: CreateSpacePayload) {
  return apiFetch<Space>('/spaces', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateSpace(slug: string, payload: UpdateSpacePayload) {
  return apiFetch<Space>(`/spaces/${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteSpace(slug: string) {
  return apiFetch<void>(`/spaces/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
  });
}
