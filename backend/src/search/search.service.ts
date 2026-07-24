import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EmbeddingProvider } from '../embeddings/providers/embedding-provider.interface';
import { EMBEDDING_PROVIDER } from '../embeddings/providers/embedding-provider.token';
import { MetricsService } from '../metrics/metrics.service';
import { RequestUser } from '../common/user-request';
import { FtsResult, MergedResult, VectorResult, rrfMerge } from './rrf-merge';

export type SearchEntityKind = 'skill' | 'artifact';
export type SearchMode = 'hybrid' | 'fts' | 'semantic';

export interface SearchHit {
  kind: SearchEntityKind;
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
  kind?: SearchEntityKind | 'all';
  limit?: number;
  service?: string | null;
  bypassDeptFilter?: boolean;
}

// Phase 2C: extended input for hybrid artifact search.
export interface HybridSearchInput {
  query: string;
  mode?: SearchMode; // default 'hybrid'; overridden to 'fts' when SEARCH_MODE=fts-only
  spaceId?: string;
  templateKey?: string;
  tags?: string[];
  departmentId?: number; // caller-supplied; defaults to req.user.departmentId
  limit?: number;
}

// Result shape for hybrid search (artifact-only, richer than SearchHit).
export interface HybridSearchHit {
  artifactId: string;
  versionId: string;
  title: string;
  slug: string;
  templateKey: string | null;
  spaceId: string | null;
  tags: string[];
  snippet: string;
  source: 'hybrid' | 'fts' | 'semantic';
  ftsRank?: number;
  vectorRank?: number;
  rrfScore: number;
}

const DEFAULT_KNOWN_SERVICES = ['postgres', 'redis', 'nginx', 'minio', 'backend', 'portal', 'gitlab'];

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly knownServices: string[];
  // Kill-switch: if SEARCH_MODE=fts-only, vector branch is never used.
  private readonly forceFtsOnly: boolean;

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @Optional() @Inject(EMBEDDING_PROVIDER) private readonly embeddingProvider: EmbeddingProvider | null,
    @Optional() private readonly metrics: MetricsService | null,
  ) {
    const raw = process.env.ONEMCP_KNOWN_SERVICES ?? '';
    this.knownServices = raw.trim()
      ? raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
      : DEFAULT_KNOWN_SERVICES;

    this.forceFtsOnly = (process.env.SEARCH_MODE ?? '').toLowerCase() === 'fts-only';
    if (this.forceFtsOnly) {
      this.logger.warn('SEARCH_MODE=fts-only — vector branch disabled (kill-switch active)');
    }
  }

  getKnownServices(): readonly string[] {
    return this.knownServices;
  }

  detectService(q: string, knownServices?: string[]): string | null {
    const services = knownServices ?? this.knownServices;
    const matches = services.filter((s) => new RegExp(`\\b${s}\\b`, 'i').test(q));
    if (matches.length === 1) return matches[0];
    if (matches.length > 1 && process.env.SEARCH_DEBUG === '1') {
      this.logger.debug(`Service ambiguous: ${matches.join(',')} in query "${q}"`);
    }
    return null;
  }

  // Original FTS-based search (skills + artifacts). Preserved for backward compat.
  async search(user: RequestUser, params: SearchParams): Promise<SearchHit[]> {
    const q = params.q.trim();
    if (q.length < 2) return [];
    const kind = params.kind ?? 'all';
    const limit = Math.min(params.limit ?? 20, 50);

    const isSystemCaller = (user.roles as readonly string[]).includes('system');
    const bypassDept = isSystemCaller && params.bypassDeptFilter === true;

    let service: string | null = null;
    if (params.service != null && params.service !== '') {
      service = params.service.toLowerCase();
    } else {
      service = this.detectService(q);
    }

    if (service && process.env.SEARCH_DEBUG === '1') {
      this.logger.debug(`Search service hint: "${service}" for query "${q}"`);
    }

    const results: SearchHit[] = [];
    if (kind === 'all' || kind === 'artifact') {
      results.push(...(await this.searchArtifacts(user, q, limit, service, bypassDept)));
    }
    if (kind === 'all' || kind === 'skill') {
      results.push(...(await this.searchSkills(user, q, limit, service, bypassDept)));
    }
    return results.sort((a, b) => b.rank - a.rank).slice(0, limit);
  }

  // Phase 2C: hybrid search — FTS + vector + RRF merge.
  // Artifacts only (semantic search on artifact body vectors).
  async hybrid(user: RequestUser, input: HybridSearchInput): Promise<HybridSearchHit[]> {
    const query = input.query.trim();
    if (query.length < 2) return [];

    const limit = Math.min(input.limit ?? 20, 100);
    const deptId = input.departmentId ?? user.departmentId;

    // Kill-switch or caller requests fts-only
    const effectiveMode: SearchMode =
      this.forceFtsOnly ? 'fts' : (input.mode ?? 'hybrid');

    this.metrics?.searchModeUsed?.inc({ mode: effectiveMode });

    // FTS branch — always runs (unless mode='semantic' which still needs FTS for snippet)
    const ftsResults: FtsResult[] =
      effectiveMode !== 'semantic'
        ? await this.runFtsQuery(query, deptId, input, limit)
        : [];

    // Vector branch — only if mode != 'fts' and kill-switch off
    let vectorResults: VectorResult[] = [];
    if (effectiveMode !== 'fts' && !this.forceFtsOnly) {
      vectorResults = await this.runVectorQuery(query, deptId, input, limit);
    }

    // If semantic-only, treat vector results as primary
    if (effectiveMode === 'semantic') {
      return this.buildHitsFromVector(vectorResults, query, limit);
    }

    // RRF merge — works for 'hybrid' (both lists) and 'fts' (vector list empty)
    const merged = rrfMerge(ftsResults, vectorResults, limit);
    return this.hydrateHits(merged, effectiveMode);
  }

  // Run FTS query on artifact_versions.body_search. Returns ordered by ts_rank desc.
  private async runFtsQuery(
    query: string,
    deptId: number,
    input: HybridSearchInput,
    limit: number,
  ): Promise<FtsResult[]> {
    const params: unknown[] = [deptId, query, limit];
    const filterClauses = this.buildArtifactFilterClauses(input, params);

    const rows = await this.ds.query<
      Array<{ artifact_id: string; version_id: string; fts_rank: number; snippet: string }>
    >(
      `SELECT a.id AS artifact_id, av.id AS version_id,
              ts_rank_cd(av.body_search, plainto_tsquery('simple', immutable_unaccent($2))) AS fts_rank,
              ts_headline(
                'simple',
                immutable_unaccent(COALESCE(av.body, '')),
                plainto_tsquery('simple', immutable_unaccent($2)),
                'MaxWords=25, MinWords=10, ShortWord=3'
              ) AS snippet
       FROM artifacts a
       JOIN artifact_versions av ON av.id = a.current_version_id
       WHERE a.department_id = $1
         AND a.status = 'published'
         AND av.body_search @@ plainto_tsquery('simple', immutable_unaccent($2))
         ${filterClauses}
       ORDER BY fts_rank DESC
       LIMIT $3`,
      params,
    );

    return rows.map((r) => ({
      artifactId: r.artifact_id,
      versionId: r.version_id,
      ftsRank: Number(r.fts_rank),
      snippet: r.snippet ?? '',
    }));
  }

  // Run vector query using cosine distance. Returns ordered by distance asc.
  // Falls back to empty array on provider error (TEI down, etc.)
  private async runVectorQuery(
    query: string,
    deptId: number,
    input: HybridSearchInput,
    limit: number,
  ): Promise<VectorResult[]> {
    if (!this.embeddingProvider) {
      this.logger.warn('No embedding provider injected — skipping vector branch');
      return [];
    }

    let queryVec: number[];
    try {
      queryVec = await this.embeddingProvider.embed(query);
    } catch (err) {
      this.logger.warn(`Embedding provider error — falling back to FTS only: ${(err as Error).message}`);
      return [];
    }

    const vecLiteral = `[${queryVec.join(',')}]`;
    const params: unknown[] = [deptId, vecLiteral, limit];
    const filterClauses = this.buildArtifactFilterClauses(input, params);

    try {
      const rows = await this.ds.query<
        Array<{ artifact_id: string; version_id: string; distance: number }>
      >(
        `SELECT a.id AS artifact_id, av.id AS version_id,
                (e.vector::vector <=> $2::vector) AS distance
         FROM embeddings e
         JOIN artifact_versions av ON av.id = e.artifact_version_id
         JOIN artifacts a ON a.id = av.artifact_id
         WHERE a.department_id = $1
           AND a.status = 'published'
           AND a.current_version_id = av.id
           ${filterClauses}
         ORDER BY distance ASC
         LIMIT $3`,
        params,
      );

      return rows.map((r, idx) => ({
        artifactId: r.artifact_id,
        versionId: r.version_id,
        distance: Number(r.distance),
        vectorRank: idx + 1,
      }));
    } catch (err) {
      this.logger.warn(`Vector query failed — falling back to FTS only: ${(err as Error).message}`);
      return [];
    }
  }

  // Build filter WHERE clauses from optional input fields.
  // Appends bound params to the params array (mutates in place) and returns clause string.
  private buildArtifactFilterClauses(input: HybridSearchInput, params: unknown[]): string {
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

  // Build hits from vector-only results (semantic mode).
  // No FTS snippet available — use substring of body as fallback snippet.
  private async buildHitsFromVector(
    vectorResults: VectorResult[],
    _query: string,
    limit: number,
  ): Promise<HybridSearchHit[]> {
    if (vectorResults.length === 0) return [];

    const versionIds = vectorResults.slice(0, limit).map((r) => r.versionId);
    const rows = await this.ds.query<
      Array<{ artifact_id: string; version_id: string; title: string; slug: string; template_key: string | null; space_id: string | null; tags: string[]; body: string }>
    >(
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

  // Hydrate merged RRF results with artifact metadata.
  private async hydrateHits(merged: MergedResult[], mode: SearchMode): Promise<HybridSearchHit[]> {
    if (merged.length === 0) return [];

    const versionIds = merged.map((m) => m.versionId);
    const rows = await this.ds.query<
      Array<{ artifact_id: string; version_id: string; title: string; slug: string; template_key: string | null; space_id: string | null; tags: string[] }>
    >(
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

  private async searchArtifacts(
    user: RequestUser,
    q: string,
    limit: number,
    service: string | null,
    bypassDept = false,
  ): Promise<SearchHit[]> {
    const deptClause = bypassDept ? 'TRUE' : 'a.department_id = $1';

    const rows = await this.ds.query<
      Array<{
        id: string;
        title: string;
        slug: string;
        type: string;
        status: string;
        service: string | null;
        tags: string[];
        snippet: string;
        rank: number;
      }>
    >(
      `
      SELECT a.id, a.title, a.slug, a.type, a.status, a.service, a.tags,
             ts_headline(
               'simple',
               immutable_unaccent(COALESCE(v.body, '')),
               plainto_tsquery('simple', immutable_unaccent($2)),
               'MaxWords=25, MinWords=10, ShortWord=3'
             ) AS snippet,
             (
               COALESCE(ts_rank_cd(v.body_search, plainto_tsquery('simple', immutable_unaccent($2))), 0) * 2
               + similarity(immutable_unaccent(a.title), immutable_unaccent($2))
               + CASE WHEN a.type = 'runbook' AND $4::text IS NOT NULL AND a.service = $4 THEN 2.0 ELSE 0 END
               + CASE WHEN $4::text IS NOT NULL AND EXISTS (
                   SELECT 1 FROM unnest(a.tags) t WHERE lower(t) = $4
                 ) THEN 1.0 ELSE 0 END
             ) AS rank
      FROM artifacts a
      LEFT JOIN artifact_versions v ON v.id = a.current_version_id
      WHERE ${deptClause}
        AND a.status = 'published'
        AND (
          v.body_search @@ plainto_tsquery('simple', immutable_unaccent($2))
          OR immutable_unaccent(a.title) ILIKE '%' || immutable_unaccent($2) || '%'
          OR a.slug ILIKE '%' || $2 || '%'
        )
      ORDER BY rank DESC
      LIMIT $3
      `,
      [user.departmentId, q, limit, service],
    );

    return rows.map((r) => ({
      kind: 'artifact' as const,
      id: r.id,
      name: r.title,
      slug: r.slug,
      snippet: r.snippet || '',
      tags: r.tags,
      rank: Number(r.rank),
      meta: { type: r.type, status: r.status, service: r.service ?? null },
    }));
  }

  private async searchSkills(
    user: RequestUser,
    q: string,
    limit: number,
    service: string | null,
    bypassDept = false,
  ): Promise<SearchHit[]> {
    const rows = await this.ds.query<
      Array<{
        id: number;
        name: string;
        description: string | null;
        tags: string[];
        snippet: string;
        rank: number;
        current_version_id: number | null;
      }>
    >(
      `
      SELECT s.id, s.name, s.description, s.tags, s."currentVersionId" AS current_version_id,
             ts_headline(
               'simple',
               immutable_unaccent(COALESCE(v.body, s.description, '')),
               plainto_tsquery('simple', immutable_unaccent($2)),
               'MaxWords=25, MinWords=10, ShortWord=3'
             ) AS snippet,
             (
               COALESCE(ts_rank_cd(v.body_search, plainto_tsquery('simple', immutable_unaccent($2))), 0) * 2
               + similarity(immutable_unaccent(s.name), immutable_unaccent($2))
               + CASE WHEN immutable_unaccent(COALESCE(s.description, '')) ILIKE '%' || immutable_unaccent($2) || '%' THEN 0.5 ELSE 0 END
               + CASE WHEN $4::text IS NOT NULL AND EXISTS (
                   SELECT 1 FROM unnest(s.tags) t WHERE lower(t) = $4
                 ) THEN 0.5 ELSE 0 END
             ) AS rank
      FROM skills s
      LEFT JOIN skill_versions v ON v.id = s."currentVersionId"
      WHERE ${bypassDept ? 'TRUE' : 's.department_id = $1'}
        AND s.status <> 'archived'
        AND (
          (v.body_search IS NOT NULL AND v.body_search @@ plainto_tsquery('simple', immutable_unaccent($2)))
          OR immutable_unaccent(s.name) ILIKE '%' || immutable_unaccent($2) || '%'
          OR immutable_unaccent(COALESCE(s.description, '')) ILIKE '%' || immutable_unaccent($2) || '%'
        )
      ORDER BY rank DESC
      LIMIT $3
      `,
      [user.departmentId, q, limit, service],
    );

    return rows.map((r) => ({
      kind: 'skill' as const,
      id: String(r.id),
      name: r.name,
      slug: r.name,
      snippet: r.snippet || r.description || '',
      tags: r.tags,
      rank: Number(r.rank),
      meta: { hasActiveVersion: r.current_version_id !== null },
    }));
  }
}
