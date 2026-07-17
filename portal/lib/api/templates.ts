import { apiFetch } from '../api-client';
import type { ArtifactType } from './artifacts';

export interface TemplateField {
  key: string;
  label: string;
  type: 'text' | 'markdown';
  required: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  description?: string;
}

export interface Template {
  type: ArtifactType;
  version: number;
  description: string;
  fields: TemplateField[];
}

export function listTemplates() {
  return apiFetch<Template[]>('/artifact-templates');
}

export function getTemplate(type: ArtifactType) {
  return apiFetch<Template>(`/artifact-templates/${encodeURIComponent(type)}`);
}
