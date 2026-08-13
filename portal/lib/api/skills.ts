import { apiFetch } from '../api-client';

export interface Skill {
  id: number;
  name: string;
  departmentId: number;
  repoUrl: string;
  currentVersionId: number | null;
  ownerId: number | null;
  status: 'active' | 'deprecated' | 'archived';
  description: string | null;
  tags: string[];
  projectId: number | null;
  projectSlug: string | null;
  projectName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SkillVersion {
  id: number;
  skillId: number;
  commitSha: string;
  version: string | null;
  manifest: Record<string, unknown>;
  body: string | null;
  approvedBy: number | null;
  approvedAt: string | null;
  status: 'pending' | 'active' | 'rejected';
  createdAt: string;
}

export function listSkills(params: { tag?: string; q?: string; projectId?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.tag) qs.set('tag', params.tag);
  if (params.q) qs.set('q', params.q);
  if (params.projectId !== undefined) qs.set('projectId', String(params.projectId));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<Skill[]>(`/skills${suffix}`);
}

export function triggerSkillsSync(projectId?: number): Promise<{ accepted: boolean; jobId: string; projectId: number | null }> {
  return apiFetch('/skills/sync', {
    method: 'POST',
    body: JSON.stringify(projectId ? { projectId } : {}),
  });
}

export function getSkill(name: string) {
  return apiFetch<Skill>(`/skills/${encodeURIComponent(name)}`);
}

export function listSkillVersions(name: string) {
  return apiFetch<SkillVersion[]>(`/skills/${encodeURIComponent(name)}/versions`);
}

export function approveSkillVersion(name: string, versionId: number) {
  return apiFetch<SkillVersion>(
    `/skills/${encodeURIComponent(name)}/versions/${versionId}/approve`,
    { method: 'POST' },
  );
}

export function rejectSkillVersion(name: string, versionId: number) {
  return apiFetch<SkillVersion>(
    `/skills/${encodeURIComponent(name)}/versions/${versionId}/reject`,
    { method: 'POST' },
  );
}

export function triggerSkillSync() {
  return apiFetch<{ accepted: boolean; jobId?: string }>(`/skills/sync`, { method: 'POST' });
}
