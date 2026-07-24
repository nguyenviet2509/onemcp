import { apiFetch } from '../api-client';
import type { SearchHit } from './search';

// Saved search — user-owned persisted query + filter set.
export interface SavedSearchFilters {
  mode?: 'hybrid' | 'vector' | 'fts';
  space?: string;
  templateKey?: string;
  tags?: string[];
  dept?: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SavedSearchFilters;
  createdAt: string;
  lastRunAt: string | null;
}

export interface CreateSavedSearchPayload {
  name: string;
  query: string;
  filters?: SavedSearchFilters;
}

export function listMySaved() {
  return apiFetch<SavedSearch[]>('/saved-searches');
}

export function createSaved(payload: CreateSavedSearchPayload) {
  return apiFetch<SavedSearch>('/saved-searches', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteSaved(id: string) {
  return apiFetch<void>(`/saved-searches/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// Re-runs the saved search and returns fresh results.
export function runSaved(id: string) {
  return apiFetch<SearchHit[]>(`/saved-searches/${encodeURIComponent(id)}/run`, {
    method: 'POST',
  });
}
