import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MetricsService } from '../metrics/metrics.service';
import { EmbeddingsService } from './embeddings.service';

export const EMBED_ARTIFACT_QUEUE = 'embed-artifact';
export const EMBED_ARTIFACT_JOB = 'embed';

export interface EmbedArtifactJobData {
  artifactVersionId: string;
  text: string;
}

// BullMQ worker — consumes 'embed-artifact' queue.
// Retry policy (3x exp backoff) is set by enqueuer via job options.
// On failure after all retries: BullMQ moves job to failed set; logged here for metrics.
@Processor(EMBED_ARTIFACT_QUEUE, { concurrency: 2 })
export class EmbedArtifactProcessor extends WorkerHost {
  private readonly log = new Logger(EmbedArtifactProcessor.name);

  constructor(
    private readonly embeddings: EmbeddingsService,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<EmbedArtifactJobData>): Promise<void> {
    const { artifactVersionId, text } = job.data;
    this.log.debug(`embed job=${job.id} versionId=${artifactVersionId} attempt=${job.attemptsMade + 1}`);

    try {
      const vector = await this.embeddings.provider.embed(text);
      await this.embeddings.upsertEmbedding(artifactVersionId, vector, this.embeddings.provider.name);
      this.metrics.embedCompleted.inc();
      this.log.log(`embed done job=${job.id} versionId=${artifactVersionId}`);
    } catch (err) {
      const reason = err instanceof Error ? err.constructor.name : 'unknown';
      this.log.error(`embed failed job=${job.id} versionId=${artifactVersionId}: ${(err as Error).message}`);
      this.metrics.embedFailed.inc({ reason });
      // Re-throw so BullMQ retries per job opts (attempts=3, exponential backoff).
      throw err;
    }
  }
}
