import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmbedArtifactProcessor, EMBED_ARTIFACT_QUEUE } from './embed-artifact.processor';
import { EmbedArtifactQueue } from './embed-artifact.queue';
import { Embedding } from './embedding.entity';
import { EmbeddingsService } from './embeddings.service';
import { E5SmallLocalProvider } from './providers/e5-small-local-provider';
import { EMBEDDING_PROVIDER } from './providers/embedding-provider.token';

// MetricsModule is @Global() — no explicit import needed here.
@Module({
  imports: [
    TypeOrmModule.forFeature([Embedding]),
    BullModule.registerQueue({ name: EMBED_ARTIFACT_QUEUE }),
  ],
  providers: [
    // Bind concrete provider to interface token — swap here to change backend.
    { provide: EMBEDDING_PROVIDER, useClass: E5SmallLocalProvider },
    E5SmallLocalProvider,
    EmbeddingsService,
    EmbedArtifactQueue,
    EmbedArtifactProcessor,
  ],
  exports: [EmbeddingsService, EmbedArtifactQueue],
})
export class EmbeddingsModule {}
