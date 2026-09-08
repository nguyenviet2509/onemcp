import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEvent } from './entities/audit-event.entity';

// Nightly prune of audit_events rows with action='mcp.tool.call' older than
// MCP_TOOL_AUDIT_RETENTION_DAYS (default 90). Other actions (oauth.*, project.*)
// retained indefinitely for compliance.
//
// Red-team fixes:
//   F5: retention gated on its OWN flag (MCP_TOOL_AUDIT_RETENTION_ENABLED, default
//       true) — NOT the write flag. When write flag flipped off during rollback,
//       cron keeps pruning safely (WHERE clause matches nothing new).
//   F9: explicit timeZone: 'UTC' — no drift under DST or VPS TZ change.
//   F13: pg_try_advisory_lock guards against multi-replica double-DELETE.
@Injectable()
export class AuditRetentionService {
  private readonly log = new Logger(AuditRetentionService.name);
  private readonly retentionDays: number;
  private readonly enabled: boolean;
  // Arbitrary stable int64 identifying this cron across replicas. Any int is fine
  // as long as it doesn't collide with other advisory locks in the app (currently
  // none use pg_advisory_lock in OneMCP backend).
  private static readonly LOCK_ID = '8921034567891';

  constructor(
    @InjectRepository(AuditEvent) private readonly repo: Repository<AuditEvent>,
    config: ConfigService,
  ) {
    this.retentionDays = parseInt(
      config.get<string>('MCP_TOOL_AUDIT_RETENTION_DAYS', '90'),
      10,
    );
    // F5: separate flag from write path. Default true — retention always on, safe.
    this.enabled =
      (config.get<string>('MCP_TOOL_AUDIT_RETENTION_ENABLED', 'true') || 'true').toLowerCase() !==
      'false';
    this.log.log(
      `Audit retention: enabled=${this.enabled} days=${this.retentionDays} ` +
        `resolvedTZ=${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
    );
  }

  // Daily 03:00 UTC — off-peak, avoids backup cron window.
  @Cron('0 3 * * *', { timeZone: 'UTC', name: 'audit-mcp-retention' })
  async prune(): Promise<void> {
    if (!this.enabled) return;
    if (isNaN(this.retentionDays) || this.retentionDays <= 0) {
      this.log.warn('MCP_TOOL_AUDIT_RETENTION_DAYS invalid — skip prune');
      return;
    }

    // F13: advisory lock — only one replica runs DELETE. Session-scoped, auto
    // released if process crashes (Postgres handles cleanup on disconnect).
    const acq = await this.repo.query(`SELECT pg_try_advisory_lock($1) AS locked`, [
      AuditRetentionService.LOCK_ID,
    ]);
    const locked: boolean = acq[0]?.locked === true;
    if (!locked) {
      this.log.log('prune skipped: another replica holds the retention lock');
      return;
    }

    try {
      const cutoff = new Date(Date.now() - this.retentionDays * 86400_000);
      const result = await this.repo
        .createQueryBuilder()
        .delete()
        .from(AuditEvent)
        .where('action = :action AND ts < :cutoff', {
          action: 'mcp.tool.call',
          cutoff,
        })
        .execute();
      const deleted = result.affected ?? 0;
      this.log.log(
        `Pruned ${deleted} mcp.tool.call rows older than ${cutoff.toISOString()} (${this.retentionDays}d)`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.error(`prune failed: ${msg}`);
    } finally {
      await this.repo
        .query(`SELECT pg_advisory_unlock($1)`, [AuditRetentionService.LOCK_ID])
        .catch(() => {
          // Session may already be closed on error; Postgres cleans up automatically.
        });
    }
  }
}
