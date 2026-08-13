import { apiFetch } from '../api-client';

export type ProjectScope = 'public' | 'dept' | 'private';
export type ProjectStatus = 'pending' | 'approved' | 'rejected' | 'active' | 'suspended';

export interface Project {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  gitRepoUrl: string;
  scope: ProjectScope;
  status: ProjectStatus;
  departmentId: number | null;
  ownerId: number | null;
  approvedAt: string | null;
  approvedById: number | null;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectPayload {
  slug: string;
  name: string;
  description?: string;
  gitRepoUrl: string;
  scope?: ProjectScope;
}

export interface ProjectWithSecret {
  project: Project;
  webhookSecret: string;
}

export function listProjects(): Promise<Project[]> {
  return apiFetch<Project[]>('/projects');
}

export function getProject(id: number): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}`);
}

export function createProject(payload: CreateProjectPayload): Promise<ProjectWithSecret> {
  return apiFetch<ProjectWithSecret>('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function approveProject(id: number): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}/approve`, { method: 'PATCH' });
}

export function rejectProject(id: number, reason?: string): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

export function suspendProject(id: number): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}/suspend`, { method: 'PATCH' });
}

export function resumeProject(id: number): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}/resume`, { method: 'PATCH' });
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string;
  gitRepoUrl?: string;
  scope?: ProjectScope;
}

export function updateProject(id: number, patch: UpdateProjectPayload): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function deleteProject(id: number): Promise<void> {
  return apiFetch<void>(`/projects/${id}`, { method: 'DELETE' });
}

export function setDeployToken(id: number, token: string): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}/deploy-token`, {
    method: 'PATCH',
    body: JSON.stringify({ token }),
  });
}

export function regenerateSecret(id: number): Promise<ProjectWithSecret> {
  return apiFetch<ProjectWithSecret>(`/projects/${id}/regen-secret`, { method: 'POST' });
}
