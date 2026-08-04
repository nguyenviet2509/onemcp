import { apiFetch } from '../api-client';
import type { SearchHit } from './search';

// Saved search — user-owned persisted query + filter set.
// Shape mirrors backend SavedSearch entity: `mode` lives at top-level, and the
// filters bag holds spaceId/templateKey/tags/dept only. `lastRunAt` is not
// tracked server-side.
export type SavedSearchMode = 'hybrid' | 'fts' | 'semantic';

export interface SavedSearchFilters {
  spaceId?: string;
  templateKey?: string;
  tags?: string[];
  dept?: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SavedSearchFilters;
  mode: SavedSearchMode;
  createdAt: string;
}

export interface CreateSavedSearchPayload {
  name: string;
  query: string;
  filters?: SavedSearchFilters;
  mode?: SavedSearchMode;
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
// Backend uses GET (idempotent, cacheable) — must match the controller decorator.
export function runSaved(id: string) {
  return apiFetch<SearchHit[]>(`/saved-searches/${encodeURIComponent(id)}/run`);
}
