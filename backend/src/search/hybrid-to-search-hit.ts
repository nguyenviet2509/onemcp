// Adapter: HybridSearchHit → legacy SearchHit shape for HTTP callers (portal).
//
// Root cause fix (2026-09-03): HTTP endpoints /search?mode=… and
// /saved-searches/:id/run were returning raw HybridSearchHit; portal SearchHit
// interface expects `id`/`name`/`kind` → `hit.id` was undefined → link
// `/artifacts/undefined` → 500.
//
// MCP tool handler (search-tool-handler.ts) still consumes HybridSearchHit
// directly; this adapter lives only at the HTTP boundary.

import { HybridSearchHit, SearchHit } from './search.service';

export function hybridToSearchHit(h: HybridSearchHit): SearchHit {
  return {
    kind: 'artifact',
    id: h.artifactId,
    name: h.title,
    slug: h.slug,
    snippet: h.snippet,
    tags: h.tags,
    rank: h.rrfScore,
    meta: {
      source: h.source,
      rrfScore: h.rrfScore,
      ftsRank: h.ftsRank,
      vectorRank: h.vectorRank,
      versionId: h.versionId,
      spaceId: h.spaceId,
      templateKey: h.templateKey,
      updatedAt: h.updatedAt,
      versionNo: h.versionNo,
    },
  };
}

export function hybridToSearchHits(hits: HybridSearchHit[]): SearchHit[] {
  return hits.map(hybridToSearchHit);
}
