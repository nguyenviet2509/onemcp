import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { RunbookLoadEvent } from './entities/runbook-load-event.entity';

// Nightly retention job — xóa runbook_load_events cũ hơn RUNBOOK_EVENTS_RETAIN_DAYS ngày (default 90).
// RT-15: audit table phải có TTL từ day 1.
@Injectable()
export class RunbookEventsRetentionService {
  private readonly log = new Logger(RunbookEventsRetentionService.name);

  constructor(
    @InjectRepository(RunbookLoadEvent)
    private readonly events: Repository<RunbookLoadEvent>,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async pruneOldEvents(): Promise<void> {
    const retainDays = parseInt(
      this.config.get<string>('RUNBOOK_EVENTS_RETAIN_DAYS', '90'),
      10,
    );
    if (isNaN(retainDays) || retainDays <= 0) {
      this.log.warn('RUNBOOK_EVENTS_RETAIN_DAYS invalid — skip prune');
      return;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retainDays);

    try {
      const result = await this.events.delete({ ts: LessThan(cutoff) });
      const deleted = result.affected ?? 0;
      if (deleted > 0) {
        this.log.log(`runbook_load_events pruned: ${deleted} rows older than ${retainDays} days`);
      }
    } catch (err) {
      this.log.error('runbook_load_events prune failed', err);
    }
  }
}
