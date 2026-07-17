import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SkillSyncService } from './skill-sync.service';
import { SkillSyncJobData, SKILL_SYNC_QUEUE } from './skill-sync.queue';

@Processor(SKILL_SYNC_QUEUE, { concurrency: 1 })
export class SkillSyncProcessor extends WorkerHost {
  private readonly log = new Logger(SkillSyncProcessor.name);

  constructor(private readonly sync: SkillSyncService) {
    super();
  }

  async process(job: Job<SkillSyncJobData>) {
    this.log.log(`process jobId=${job.id} trigger=${job.data.trigger}`);
    const summary = await this.sync.syncAll();
    this.log.log(
      `job=${job.id} done head=${summary.headSha.slice(0, 8)} newVer=${summary.newVersions} err=${summary.errors.length}`,
    );
    return summary;
  }
}
