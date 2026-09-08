import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEvent } from './entities/audit-event.entity';
import { RequestUser } from '../common/user-request';
import { CentralRbacAuditPublisher } from './central-rbac-audit-publisher.service';

export interface AuditWrite {
  actor?: RequestUser | null;
  action: string;
  resourceType?: string;
  resourceId?: string | number;
  before?: unknown;
  after?: unknown;
  ip?: string;
  sessionId?: string;
}

// Enrich bare username → full email for consistency với Zitadel-source events
// (Zitadel gửi email full, OneMCP local users chỉ có username local-part).
// Configurable qua AUDIT_ACTOR_EMAIL_DOMAIN env (default 'inet.vn' internal).
function toActorEmail(username: string | null | undefined, domain: string): string {
  if (!username) return '';
  if (username.includes('@')) return username;
  return `${username}@${domain}`;
}

@Injectable()
export class AuditLogService {
  private readonly log = new Logger(AuditLogService.name);
  private readonly emailDomain: string;

  constructor(
    @InjectRepository(AuditEvent) private readonly repo: Repository<AuditEvent>,
    private readonly centralPublisher: CentralRbacAuditPublisher,
    config: ConfigService,
  ) {
    this.emailDomain = config.get<string>('AUDIT_ACTOR_EMAIL_DOMAIN', 'inet.vn').trim();
  }

  // Fire-and-forget dual-write:
  //   1. Local audit_events (fallback if central unreachable)
  //   2. Central RBAC audit_log (canonical cross-app store)
  // Neither await'd on caller path.
  record(entry: AuditWrite): void {
    const row = this.repo.create({
      actorUserId: entry.actor?.id ?? null,
      actorUsername: entry.actor?.username ?? null,
      action: entry.action,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId != null ? String(entry.resourceId) : null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      ip: entry.ip ?? null,
      sessionId: entry.sessionId ?? null,
    });
    this.repo.save(row).catch((err) => {
      this.log.error(`audit_insert_fail action=${entry.action}: ${err.message}`);
    });

    // High-volume `mcp.tool.call` → publish COMPACT DIGEST only (not full payload).
    // Central RBAC gets tamper-evident hash chain over metadata (ts, actor, tool,
    // args_hash) — enough for compliance + evidence-erasure protection. Full args
    // stays local (Phase 07 portal reads local; cross-reference by args_hash).
    // Red-team F3 fix: was "skip publish" — inverted to prevent deletion vector.
    if (entry.action === 'mcp.tool.call') {
      const before = entry.before as { args_hash?: string } | undefined;
      const after = entry.after as { status?: string; duration_ms?: number } | undefined;
      this.centralPublisher.publish({
        action: entry.action,
        target_type: entry.resourceType ?? 'n/a',
        target_id: 'digest', // marker for compact form
        actor_id: entry.actor?.id != null ? String(entry.actor.id) : 'service',
        actor_type: entry.actor ? 'user' : 'service',
        actor_email: toActorEmail(entry.actor?.username, this.emailDomain),
        before_state: { args_hash: before?.args_hash }, // hash only, never raw args
        after_state: { status: after?.status, duration_ms: after?.duration_ms },
        ip: entry.ip,
        session_id: entry.sessionId,
      });
      return;
    }

    // State-change events (oauth.*, project.*, user.*, sync.*) — full payload publish
    this.centralPublisher.publish({
      action: entry.action,
      target_type: entry.resourceType ?? 'n/a',
      target_id: entry.resourceId != null ? String(entry.resourceId) : 'n/a',
      actor_id: entry.actor?.id != null ? String(entry.actor.id) : 'service',
      actor_type: entry.actor ? 'user' : 'service',
      actor_email: toActorEmail(entry.actor?.username, this.emailDomain),
      before_state: entry.before,
      after_state: entry.after,
      ip: entry.ip,
      session_id: entry.sessionId,
    });
  }
}
