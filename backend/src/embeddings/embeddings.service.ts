import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Embedding } from './embedding.entity';
import { EmbeddingProvider } from './providers/embedding-provider.interface';
import { EMBEDDING_PROVIDER } from './providers/embedding-provider.token';

// CRUD layer for embeddings table.
// vector stored as pgvector literal string "[f1,f2,...]" — TypeORM maps as text column.
// Callers (processor, search service) handle serialize/deserialize via serializeVector/parseVector.
@Injectable()
export class EmbeddingsService {
  private readonly log = new Logger(EmbeddingsService.name);

  constructor(
    @InjectRepository(Embedding) private readonly repo: Repository<Embedding>,
    @Inject(EMBEDDING_PROVIDER) readonly provider: EmbeddingProvider,
  ) {}

  // Serialize float[] to pgvector string literal.
  static serializeVector(vec: number[]): string {
    return `[${vec.join(',')}]`;
  }

  // Upsert — conflict on PK replaces vector + model + created_at.
  async upsertEmbedding(artifactVersionId: string, vector: number[], model: string): Promise<void> {
    const vectorStr = EmbeddingsService.serializeVector(vector);
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(Embedding)
      .values({ artifactVersionId, vector: vectorStr, model })
      .orUpdate(['vector', 'model', 'created_at'], ['artifact_version_id'])
      .execute();
    this.log.debug(`upsert embedding versionId=${artifactVersionId} model=${model}`);
  }

  async getByVersionId(artifactVersionId: string): Promise<Embedding | null> {
    return this.repo.findOne({ where: { artifactVersionId } });
  }

  // Cascade-delete embeddings for all versions of a given artifact.
  // Relies on ON DELETE CASCADE in DB schema — this is a manual sweep for explicit deletes.
  async deleteByArtifactVersionId(artifactVersionId: string): Promise<void> {
    await this.repo.delete({ artifactVersionId });
  }
}
