// Hydration helpers: fetch artifact metadata rows from DB and map to HybridSearchHit.
// Extracted from search.service.ts to keep that file under 200 lines.
// Both functions are stateless except for the DataSource dependency passed explicitly.

import { DataSource } from 'typeorm';
import { HybridSearchHit, SearchMode } from './search.service';
import { MergedResult, VectorResult } from './rrf-merge';

type ArtifactMetaRow = {
  artifact_id: string;
  version_id: string;
  title: string;
  slug: string;
  template_key: string | null;
  space_id: string | null;
  tags: string[];
};

/**
 * Build HybridSearchHit[] from vector-only results (semantic mode).
 * No FTS snippet — uses first 200 chars of body as fallback.
 */
export async function buildHitsFromVector(
  ds: DataSource,
  vectorResults: VectorResult[],
  limit: number,
): Promise<HybridSearchHit[]> {
  if (vectorResults.length === 0) return [];

  const versionIds = vectorResults.slice(0, limit).map((r) => r.versionId);
  const rows = await ds.query<Array<ArtifactMetaRow & { body: string }>>(
    `SELECT a.id AS artifact_id, av.id AS version_id, a.title, a.slug,
            a.template_key, a.space_id, a.tags, LEFT(av.body, 300) AS body
     FROM artifact_versions av
     JOIN artifacts a ON a.id = av.artifact_id
     WHERE av.id = ANY($1::bigint[])`,
    [versionIds],
  );

  const rowMap = new Map(rows.map((r) => [r.version_id, r]));

  return vectorResults
    .slice(0, limit)
    .flatMap((v, idx) => {
      const r = rowMap.get(v.versionId);
      if (!r) return [];
      const hit: HybridSearchHit = {
        artifactId: v.artifactId,
        versionId: v.versionId,
        title: r.title,
        slug: r.slug,
        templateKey: r.template_key,
        spaceId: r.space_id,
        tags: r.tags,
        snippet: r.body?.slice(0, 200) ?? '',
        source: 'semantic',
        vectorRank: idx + 1,
        rrfScore: 1 / (60 + idx + 1),
      };
      return [hit];
    });
}

/**
 * Hydrate merged RRF results with artifact metadata from DB.
 * mode param used to override source label when 'fts' forced.
 */
export async function hydrateHits(
  ds: DataSource,
  merged: MergedResult[],
  mode: SearchMode,
): Promise<HybridSearchHit[]> {
  if (merged.length === 0) return [];

  const versionIds = merged.map((m) => m.versionId);
  const rows = await ds.query<Array<ArtifactMetaRow>>(
    `SELECT a.id AS artifact_id, av.id AS version_id, a.title, a.slug,
            a.template_key, a.space_id, a.tags
     FROM artifact_versions av
     JOIN artifacts a ON a.id = av.artifact_id
     WHERE av.id = ANY($1::bigint[])`,
    [versionIds],
  );

  const rowMap = new Map(rows.map((r) => [r.version_id, r]));

  return merged
    .map((m) => {
      const r = rowMap.get(m.versionId);
      if (!r) return null;

      const source: HybridSearchHit['source'] =
        m.ftsRank !== undefined && m.vectorRank !== undefined
          ? 'hybrid'
          : m.vectorRank !== undefined
            ? 'semantic'
            : 'fts';

      return {
        artifactId: m.artifactId,
        versionId: m.versionId,
        title: r.title,
        slug: r.slug,
        templateKey: r.template_key,
        spaceId: r.space_id,
        tags: r.tags,
        snippet: m.snippet,
        source: mode === 'fts' ? 'fts' : source,
        ftsRank: m.ftsRank,
        vectorRank: m.vectorRank,
        rrfScore: m.rrfScore,
      } as HybridSearchHit;
    })
    .filter((h): h is HybridSearchHit => h !== null);
}
