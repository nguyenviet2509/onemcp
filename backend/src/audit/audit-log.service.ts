import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEvent } from './entities/audit-event.entity';
import { RequestUser } from '../common/user-request';

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

@Injectable()
export class AuditLogService {
  private readonly log = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditEvent) private readonly repo: Repository<AuditEvent>,
  ) {}

  // Fire-and-forget insert. Không await ở caller để không chặn business path.
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
  }
}
