import { apiFetch } from '../api-client';

export interface SearchHit {
  kind: 'skill' | 'artifact';
  id: string;
  name: string;
  slug: string | null;
  snippet: string;
  tags: string[];
  rank: number;
  meta: Record<string, unknown>;
}

export interface SearchParams {
  q: string;
  kind?: 'all' | 'skill' | 'artifact';
  limit?: number;
  // Phase 2 hybrid search params
  mode?: 'hybrid' | 'vector' | 'fts';
  space?: string;
  templateKey?: string;
  tags?: string[];
  dept?: string;
}

export function search(params: SearchParams) {
  const qs = new URLSearchParams();
  qs.set('q', params.q);
  if (params.kind && params.kind !== 'all') qs.set('kind', params.kind);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.mode) qs.set('mode', params.mode);
  if (params.space) qs.set('space', params.space);
  if (params.templateKey) qs.set('template_key', params.templateKey);
  if (params.tags?.length) params.tags.forEach(t => qs.append('tags', t));
  if (params.dept) qs.set('dept', params.dept);
  return apiFetch<SearchHit[]>(`/search?${qs.toString()}`);
}
