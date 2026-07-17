import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { SkillSyncQueue } from './skill-sync.queue';

// Fallback resync — chống lost webhook. Cron mặc định */15 * * * *.
// Set SKILL_SYNC_CRON="" (rỗng) để tắt (dev/test).
@Injectable()
export class SkillSyncCron implements OnModuleInit {
  private readonly log = new Logger(SkillSyncCron.name);

  constructor(
    private readonly config: ConfigService,
    private readonly registry: SchedulerRegistry,
    private readonly queue: SkillSyncQueue,
  ) {}

  onModuleInit() {
    const cron = this.config.get<string>('SKILL_SYNC_CRON', '*/15 * * * *');
    if (!cron) {
      this.log.warn('SKILL_SYNC_CRON empty — skipping resync scheduler');
      return;
    }
    if (!this.config.get<string>('GITLAB_BASE_URL', '')) {
      this.log.warn('GITLAB_BASE_URL empty — skipping resync scheduler');
      return;
    }
    const job = new CronJob(cron, async () => {
      try {
        await this.queue.enqueue({ trigger: 'cron' });
      } catch (e) {
        this.log.error(`resync enqueue failed: ${(e as Error).message}`);
      }
    });
    this.registry.addCronJob('skill-sync-resync', job as unknown as Parameters<SchedulerRegistry['addCronJob']>[1]);
    job.start();
    this.log.log(`resync scheduler active — cron="${cron}"`);
  }
}
