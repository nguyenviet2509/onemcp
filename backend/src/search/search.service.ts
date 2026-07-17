import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RequestUser } from '../common/user-request';

export type SearchEntityKind = 'skill' | 'artifact';

export interface SearchHit {
  kind: SearchEntityKind;
  id: string;
  name: string; // skill.name hoặc artifact.title
  slug: string | null;
  snippet: string;
  tags: string[];
  rank: number;
  meta: Record<string, unknown>; // type, status, versionNo, ...
}

export interface SearchParams {
  q: string;
  kind?: SearchEntityKind | 'all';
  limit?: number;
}

// Hybrid keyword search: FTS trên body (tsvector) + trigram fuzzy trên title/name.
// Sort by ts_rank_cd desc, tie-break by trigram similarity.
// Semantic (pgvector) defer P4 Part 2.
@Injectable()
export class SearchService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async search(user: RequestUser, params: SearchParams): Promise<SearchHit[]> {
    const q = params.q.trim();
    if (q.length < 2) return [];
    const kind = params.kind ?? 'all';
    const limit = Math.min(params.limit ?? 20, 50);

    const results: SearchHit[] = [];
    if (kind === 'all' || kind === 'artifact') {
      results.push(...(await this.searchArtifacts(user, q, limit)));
    }
    if (kind === 'all' || kind === 'skill') {
      results.push(...(await this.searchSkills(user, q, limit)));
    }
    return results.sort((a, b) => b.rank - a.rank).slice(0, limit);
  }

  // Artifact: chỉ search published cho non-reviewer + non-owner (giữ ACL đơn giản).
  // Search trên latest active version.body. Fallback fuzzy title match.
  private async searchArtifacts(user: RequestUser, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.ds.query<
      Array<{
        id: string;
        title: string;
        slug: string;
        type: string;
        status: string;
        tags: string[];
        snippet: string;
        rank: number;
      }>
    >(
      `
      SELECT a.id, a.title, a.slug, a.type, a.status, a.tags,
             ts_headline(
               'simple',
               immutable_unaccent(COALESCE(v.body, '')),
               plainto_tsquery('simple', immutable_unaccent($2)),
               'MaxWords=25, MinWords=10, ShortWord=3'
             ) AS snippet,
             (
               COALESCE(ts_rank_cd(v.body_search, plainto_tsquery('simple', immutable_unaccent($2))), 0) * 2
               + similarity(immutable_unaccent(a.title), immutable_unaccent($2))
             ) AS rank
      FROM artifacts a
      LEFT JOIN artifact_versions v ON v.id = a.current_version_id
      WHERE a.department_id = $1
        AND a.status = 'published'
        AND (
          v.body_search @@ plainto_tsquery('simple', immutable_unaccent($2))
          OR immutable_unaccent(a.title) ILIKE '%' || immutable_unaccent($2) || '%'
          OR a.slug ILIKE '%' || $2 || '%'
        )
      ORDER BY rank DESC
      LIMIT $3
      `,
      [user.departmentId, q, limit],
    );

    return rows.map((r) => ({
      kind: 'artifact' as const,
      id: r.id,
      name: r.title,
      slug: r.slug,
      snippet: r.snippet || '',
      tags: r.tags,
      rank: Number(r.rank),
      meta: { type: r.type, status: r.status },
    }));
  }

  // Skill: name + description + body của current version.
  private async searchSkills(user: RequestUser, q: string, limit: number): Promise<SearchHit[]> {
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
             ) AS rank
      FROM skills s
      LEFT JOIN skill_versions v ON v.id = s."currentVersionId"
      WHERE s.department_id = $1
        AND s.status <> 'archived'
        AND (
          (v.body_search IS NOT NULL AND v.body_search @@ plainto_tsquery('simple', immutable_unaccent($2)))
          OR immutable_unaccent(s.name) ILIKE '%' || immutable_unaccent($2) || '%'
          OR immutable_unaccent(COALESCE(s.description, '')) ILIKE '%' || immutable_unaccent($2) || '%'
        )
      ORDER BY rank DESC
      LIMIT $3
      `,
      [user.departmentId, q, limit],
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
