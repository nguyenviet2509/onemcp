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

export function search(params: { q: string; kind?: 'all' | 'skill' | 'artifact'; limit?: number }) {
  const qs = new URLSearchParams();
  qs.set('q', params.q);
  if (params.kind && params.kind !== 'all') qs.set('kind', params.kind);
  if (params.limit) qs.set('limit', String(params.limit));
  return apiFetch<SearchHit[]>(`/search?${qs.toString()}`);
}
