// Builds dynamic WHERE clause fragments for artifact hybrid search queries.
// Mutates the params array in-place (appends bound values) and returns SQL clause string.
// Used by both FTS and vector branches in search.service.ts.

import { HybridSearchInput } from './search.service';

/**
 * Append optional filter clauses for spaceId / templateKey / tags.
 * Positional params ($N) are appended to the provided array.
 * Returns a string of "AND ..." clauses (empty string if no filters).
 */
export function buildArtifactFilterClauses(input: HybridSearchInput, params: unknown[]): string {
  const clauses: string[] = [];

  if (input.spaceId) {
    params.push(input.spaceId);
    clauses.push(`AND a.space_id = $${params.length}`);
  }
  if (input.templateKey) {
    params.push(input.templateKey);
    clauses.push(`AND a.template_key = $${params.length}`);
  }
  if (input.tags && input.tags.length > 0) {
    params.push(input.tags);
    clauses.push(`AND a.tags && $${params.length}::text[]`);
  }

  return clauses.join(' ');
}
