import { Column, Entity, PrimaryColumn } from 'typeorm';

// One row per artifact_version — PK matches FK in embeddings table (ON DELETE CASCADE).
// vector stored as text (pgvector native format "[0.1,0.2,...]") to avoid driver-level type issues.
// Serialize/deserialize handled in EmbeddingsService.
@Entity({ name: 'embeddings' })
export class Embedding {
  // artifact_version_id — bigint PK, matches artifact_versions.id
  @PrimaryColumn({ name: 'artifact_version_id', type: 'bigint' })
  artifactVersionId!: string;

  // Raw pgvector string "[f1,f2,...,f384]" — stored as text to avoid TypeORM type mismatch.
  // Cast to vector(384) happens in raw SQL queries for similarity search.
  @Column({ type: 'text' as unknown as 'simple-array' })
  vector!: string;

  @Column({ type: 'varchar', length: 64 })
  model!: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
