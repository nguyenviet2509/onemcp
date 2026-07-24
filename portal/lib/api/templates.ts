import { apiFetch } from '../api-client';

// Template — artifact creation templates scoped to dept/space (Phase 1 backend).
export interface TemplateField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'markdown' | 'select' | 'logs';
  required: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  description?: string;
  options?: string[];  // for 'select' type
}

export interface Template {
  key: string;           // unique slug, e.g. "postmortem-v2"
  label: string;         // display name
  description: string;
  deptSlug: string | null;  // null = global template
  isActive: boolean;
  version: number;
  fields: TemplateField[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplatePayload {
  key: string;
  label: string;
  description?: string;
  deptSlug?: string;
  fields: TemplateField[];
}

export interface UpdateTemplatePayload {
  label?: string;
  description?: string;
  isActive?: boolean;
  fields?: TemplateField[];
}

export function listTemplates(deptSlug?: string) {
  const qs = deptSlug ? `?dept=${encodeURIComponent(deptSlug)}` : '';
  return apiFetch<Template[]>(`/templates${qs}`);
}

export function getTemplate(key: string) {
  return apiFetch<Template>(`/templates/${encodeURIComponent(key)}`);
}

// Admin CRUD — requires CIDR-gated role.
export function createTemplate(payload: CreateTemplatePayload) {
  return apiFetch<Template>('/templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateTemplate(key: string, payload: UpdateTemplatePayload) {
  return apiFetch<Template>(`/templates/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteTemplate(key: string) {
  return apiFetch<void>(`/templates/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
}
