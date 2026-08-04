import { apiFetch } from '../api-client';

// Space — multi-department knowledge space (Phase 1 backend).
// Shape mirrors backend Space entity exactly (visibility enum, departmentId string).
export type SpaceVisibility = 'space' | 'dept' | 'cross_dept';

export interface Space {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  departmentId: string | null;
  icon: string | null;
  visibility: SpaceVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpacePayload {
  slug: string;
  name: string;
  description?: string;
  departmentId?: string;
  icon?: string;
  visibility?: SpaceVisibility;
}

export interface UpdateSpacePayload {
  name?: string;
  description?: string;
  icon?: string;
  visibility?: SpaceVisibility;
}

export function listSpaces() {
  return apiFetch<Space[]>('/spaces');
}

export function getSpace(slug: string) {
  return apiFetch<Space>(`/spaces/${encodeURIComponent(slug)}`);
}

export function listSpacesByDept(deptId: string) {
  return apiFetch<Space[]>(`/departments/${encodeURIComponent(deptId)}/spaces`);
}

// Admin: requires CIDR-gated role — server returns 403 if not authorized.
// Write paths live under /admin/spaces (backend admin controller).
export function createSpace(payload: CreateSpacePayload) {
  return apiFetch<Space>('/admin/spaces', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateSpace(slug: string, payload: UpdateSpacePayload) {
  return apiFetch<Space>(`/admin/spaces/${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteSpace(slug: string) {
  return apiFetch<void>(`/admin/spaces/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
  });
}
