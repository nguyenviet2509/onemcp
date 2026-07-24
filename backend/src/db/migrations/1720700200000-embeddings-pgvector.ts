import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase 1 multi-dept: embeddings table backed by pgvector extension.
// artifact_version_id is PK + FK — one embedding row per version, cascade delete.
// vector(384) matches all-MiniLM-L6-v2 / similar 384-dim sentence encoders.
// No HNSW index here — deferred to Phase 2 (hybrid search) once data volume warrants.
export class EmbeddingsPgvector1720700200000 implements MigrationInterface {
  name = 'EmbeddingsPgvector1720700200000';

  async up(q: QueryRunner): Promise<void> {
    // Extension already installed on host — just enable in this DB.
    await q.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

    await q.query(`
      CREATE TABLE "embeddings" (
        "artifact_version_id" BIGINT      NOT NULL PRIMARY KEY
          REFERENCES "artifact_versions"("id") ON DELETE CASCADE,
        "vector"              vector(384) NOT NULL,
        "model"               VARCHAR(64) NOT NULL,
        "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "embeddings";`);
    // Do NOT drop vector extension — other tables may depend on it.
  }
}
