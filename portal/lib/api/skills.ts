import { apiFetch } from '../api-client';

export interface Skill {
  id: number;
  name: string;
  departmentId: number;
  repoUrl: string;
  currentVersionId: number | null;
  status: 'active' | 'deprecated' | 'archived';
  description: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SkillVersion {
  id: number;
  skillId: number;
  commitSha: string;
  version: string | null;
  manifest: Record<string, unknown>;
  approvedBy: number | null;
  approvedAt: string | null;
  status: 'pending' | 'active' | 'rejected';
  createdAt: string;
}

export function listSkills(params: { tag?: string; q?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.tag) qs.set('tag', params.tag);
  if (params.q) qs.set('q', params.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<Skill[]>(`/skills${suffix}`);
}

export function getSkill(name: string) {
  return apiFetch<Skill>(`/skills/${encodeURIComponent(name)}`);
}

export function listSkillVersions(name: string) {
  return apiFetch<SkillVersion[]>(`/skills/${encodeURIComponent(name)}/versions`);
}
