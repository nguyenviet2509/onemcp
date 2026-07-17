import { Injectable, Logger } from '@nestjs/common';
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
  // Optional: service hint cho boost ranking. Nếu không pass, server auto-detect từ KNOWN_SERVICES.
  service?: string | null;
  // V2/RT-2: bypass department filter for cross-dept search.
  // ONLY honoured when caller's user.roles contains 'system'.
  // Non-system callers passing this param have it silently ignored (not 403 — guard is caller-side).
  bypassDeptFilter?: boolean;
}

// Default known services khi env không set.
const DEFAULT_KNOWN_SERVICES = ['postgres', 'redis', 'nginx', 'minio', 'backend', 'portal', 'gitlab'];

// Hybrid keyword search: FTS trên body (tsvector) + trigram fuzzy trên title/name.
// Sort by ts_rank_cd desc, tie-break by trigram similarity.
// Service boost: runbook.service match +2.0, tag match +1.0, skill tag match +0.5.
// Semantic (pgvector) defer P4 Part 2.
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly knownServices: string[];

  constructor(@InjectDataSource() private readonly ds: DataSource) {
    // Load ONEMCP_KNOWN_SERVICES từ env (Wave A đã thêm). Lowercase + trim.
    const raw = process.env.ONEMCP_KNOWN_SERVICES ?? '';
    this.knownServices = raw.trim()
      ? raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
      : DEFAULT_KNOWN_SERVICES;
  }

  // Expose danh sách known services để controller validate explicit param (RT-3).
  getKnownServices(): readonly string[] {
    return this.knownServices;
  }

  // Auto-detect service từ query text dùng word-boundary regex (RT-10).
  // Trả về null nếu: không match, hoặc match nhiều hơn 1 (ambiguous).
  detectService(q: string, knownServices?: string[]): string | null {
    const services = knownServices ?? this.knownServices;
    const matches = services.filter((s) => new RegExp(`\\b${s}\\b`, 'i').test(q));
    if (matches.length === 1) return matches[0];
    if (matches.length > 1 && process.env.SEARCH_DEBUG === '1') {
      this.logger.debug(`Service ambiguous: ${matches.join(',')} in query "${q}"`);
    }
    return null; // ambiguous hoặc không match — không boost
  }

  async search(user: RequestUser, params: SearchParams): Promise<SearchHit[]> {
    const q = params.q.trim();
    if (q.length < 2) return [];
    const kind = params.kind ?? 'all';
    const limit = Math.min(params.limit ?? 20, 50);

    // V2/RT-2: bypassDeptFilter only honoured when caller has 'system' role.
    // Checking roles array — RoleCode union doesn't include 'system' but we extend via const.
    const isSystemCaller = (user.roles as readonly string[]).includes('system');
    const bypassDept = isSystemCaller && params.bypassDeptFilter === true;

    // Resolve service hint: explicit param → auto-detect → null.
    // RT-3: explicit service đã được validate ở controller layer trước khi vào đây.
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

  // Artifact: chỉ search published cho non-reviewer + non-owner (giữ ACL đơn giản).
  // Search trên latest active version.body. Fallback fuzzy title match.
  // Service boost (RT-10, V1):
  //   +2.0 nếu type='runbook' AND a.service = $service (column tạo ở Phase 02 migration).
  //   +1.0 nếu tag (case-insensitive) khớp service — dùng EXISTS + lower() thay @> (RT-10).
  // Khi $service IS NULL, tất cả CASE bonus = 0 → ranking base không đổi.
  private async searchArtifacts(
    user: RequestUser,
    q: string,
    limit: number,
    service: string | null,
    bypassDept = false,
  ): Promise<SearchHit[]> {
    // V2/RT-2: system callers with bypassDeptFilter skip the department_id WHERE clause.
    // This allows cross-dept runbook discovery for Alertmanager alerts.
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

  // Skill: name + description + body của current version.
  // Service boost +0.5 nếu skill tag (case-insensitive) khớp service (RT-10).
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
