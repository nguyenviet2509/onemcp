import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

export const SKILL_SYNC_QUEUE = 'skill-sync';
export const SKILL_SYNC_JOB = 'sync-all';

export interface SkillSyncJobData {
  trigger: 'webhook' | 'cron' | 'manual';
  ref?: string;
  commitSha?: string;
}

@Injectable()
export class SkillSyncQueue {
  private readonly log = new Logger(SkillSyncQueue.name);

  constructor(@InjectQueue(SKILL_SYNC_QUEUE) private readonly queue: Queue<SkillSyncJobData>) {}

  async enqueue(data: SkillSyncJobData): Promise<string | undefined> {
    const job = await this.queue.add(SKILL_SYNC_JOB, data, {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
    });
    this.log.log(`enqueued trigger=${data.trigger} jobId=${job.id}`);
    return job.id;
  }
}
