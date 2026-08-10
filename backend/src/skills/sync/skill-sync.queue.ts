import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

export const SKILL_SYNC_QUEUE = 'skill-sync';
export const SKILL_SYNC_JOB = 'sync-all';

export interface SkillSyncJobData {
  trigger: 'webhook' | 'cron' | 'manual';
  ref?: string;
  commitSha?: string;
  // P7: multi-project webhook — legacy mono-repo events keep projectId undefined.
  projectId?: number;
  projectSlug?: string;
}

@Injectable()
export class SkillSyncQueue {
  private readonly log = new Logger(SkillSyncQueue.name);

  constructor(@InjectQueue(SKILL_SYNC_QUEUE) private readonly queue: Queue<SkillSyncJobData>) {}

  async enqueue(data: SkillSyncJobData): Promise<string | undefined> {
    // P8: dedup by project — single in-flight sync per project (or global for legacy).
    const dedupKey = data.projectId ? `sync-p${data.projectId}` : 'sync-global';
    const job = await this.queue.add(SKILL_SYNC_JOB, data, {
      jobId: `${dedupKey}-${Date.now()}`,
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
    });
    this.log.log(`enqueued trigger=${data.trigger} project=${data.projectId ?? 'legacy'} jobId=${job.id}`);
    return job.id;
  }
}
