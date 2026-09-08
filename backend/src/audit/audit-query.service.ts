import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEvent } from './entities/audit-event.entity';

// Response DTO — explicit shape decouples portal from TypeORM entity changes.
// Timestamps as ISO strings, tool without 'tool:' prefix, status/duration_ms
// flattened from `after` JSONB, args_hash lifted from `before` for correlation.
export interface AuditMcpCallRow {
  id: string;
  ts: string;
  actor_username: string;
  tool: string;
  resource_id?: string;
  ip?: string;
  session_id?: string;
  status: 'ok' | 'error' | 'unknown';
  duration_ms?: number;
  error?: string;
  args_hash?: string;
}

export interface AuditListResponse {
  rows: AuditMcpCallRow[];
  nextCursor?: { ts: string; id: string };
}

// Read-side service for /api/audit/mcp-calls (Phase 07 portal).
// F10 red-team fix: keyset pagination (WHERE (ts, id) < (:cts, :cid)) instead
// of offset — stable under concurrent inserts (avoids duplicates/skips).
// F12 red-team fix: listUsers() cached 5min, capped at 1000 users.
@Injectable()
export class AuditQueryService {
  private usersCache: { at: number; users: string[] } | null = null;
  private static readonly USERS_CACHE_TTL_MS = 5 * 60_000;
  private static readonly USERS_MAX = 1000;

  constructor(
    @InjectRepository(AuditEvent) private readonly repo: Repository<AuditEvent>,
  ) {}

  async queryMcpToolCalls(filter: {
    actorUsername?: string;
    tool?: string;
    from?: Date;
    to?: Date;
    status?: 'ok' | 'error';
    limit: number;
    cursor?: { ts: Date; id: string };
  }): Promise<AuditListResponse> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.action = :action', { action: 'mcp.tool.call' });

    if (filter.actorUsername) qb.andWhere('e.actorUsername = :u', { u: filter.actorUsername });
    if (filter.tool) qb.andWhere('e.resourceType = :rt', { rt: `tool:${filter.tool}` });
    if (filter.from) qb.andWhere('e.ts >= :from', { from: filter.from });
    if (filter.to) qb.andWhere('e.ts <= :to', { to: filter.to });
    // Status stored in JSONB after.status — filter with jsonb operator.
    if (filter.status) qb.andWhere(`e.after->>'status' = :st`, { st: filter.status });

    // F10: keyset cursor — deterministic ordering with (ts, id) tiebreak
    if (filter.cursor) {
      qb.andWhere('(e.ts, e.id) < (:cts, :cid)', {
        cts: filter.cursor.ts,
        cid: filter.cursor.id,
      });
    }

    qb.orderBy('e.ts', 'DESC').addOrderBy('e.id', 'DESC').limit(filter.limit + 1);
    const raw = await qb.getMany();
    const hasMore = raw.length > filter.limit;
    const rows = raw.slice(0, filter.limit);
    const last = rows[rows.length - 1];

    return {
      rows: rows.map(toRow),
      nextCursor:
        hasMore && last ? { ts: last.ts.toISOString(), id: last.id } : undefined,
    };
  }

  // F12: cached list of distinct actor_usernames for filter dropdown UI.
  // Composite index (actor_username, action, ts) allows fast index-only scan.
  async listUsers(): Promise<string[]> {
    const now = Date.now();
    if (this.usersCache && now - this.usersCache.at < AuditQueryService.USERS_CACHE_TTL_MS) {
      return this.usersCache.users;
    }
    // Note: e.actorUsername (TypeORM QB alias) maps to "actorUsername" quoted column.
    // Raw string `e.actorUsername IS NOT NULL` works because TypeORM QB parses aliases,
    // but keep quoted form defensively.
    const res = await this.repo
      .createQueryBuilder('e')
      .select('DISTINCT e.actorUsername', 'username')
      .where(`e.action = :action`, { action: 'mcp.tool.call' })
      .andWhere(`e.actorUsername IS NOT NULL`)
      .limit(AuditQueryService.USERS_MAX)
      .getRawMany();
    const users = res
      .map((r: { username?: string | null }) => r.username)
      .filter((u): u is string => Boolean(u))
      .sort();
    this.usersCache = { at: now, users };
    return users;
  }
}

// Map TypeORM entity → external DTO (decouples internal schema from API).
function toRow(e: AuditEvent): AuditMcpCallRow {
  const before = e.before as { args_hash?: string } | undefined;
  const after = e.after as
    | { status?: 'ok' | 'error'; duration_ms?: number; error?: string }
    | undefined;
  return {
    id: e.id,
    ts: e.ts.toISOString(),
    actor_username: e.actorUsername ?? '(anonymous)',
    tool: (e.resourceType ?? '').replace(/^tool:/, ''),
    resource_id: e.resourceId ?? undefined,
    ip: e.ip ?? undefined,
    session_id: e.sessionId ?? undefined,
    status: after?.status ?? 'unknown',
    duration_ms: after?.duration_ms,
    error: after?.error,
    args_hash: before?.args_hash,
  };
}
