import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EMBED_ARTIFACT_JOB, EMBED_ARTIFACT_QUEUE, EmbedArtifactJobData } from './embed-artifact.processor';

// Thin enqueue wrapper — mirrors SkillSyncQueue pattern.
// Retry policy: 3 attempts, exponential backoff starting 5s.
@Injectable()
export class EmbedArtifactQueue {
  private readonly log = new Logger(EmbedArtifactQueue.name);

  constructor(@InjectQueue(EMBED_ARTIFACT_QUEUE) private readonly queue: Queue<EmbedArtifactJobData>) {}

  async enqueue(data: EmbedArtifactJobData): Promise<string | undefined> {
    const job = await this.queue.add(EMBED_ARTIFACT_JOB, data, {
      removeOnComplete: 200,
      removeOnFail: 100,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
    });
    this.log.log(`enqueued embed versionId=${data.artifactVersionId} jobId=${job.id}`);
    return job.id;
  }
}
