import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase 2B: ivfflat index on embeddings(vector) for approximate cosine similarity search.
// lists=100 is appropriate for <100K vectors. ANALYZE after populating data for optimal performance.
// Note: index created empty — will be used post-backfill. hnsw upgrade deferred to scale phase.
export class EmbeddingsIvfflatIndex1720800000000 implements MigrationInterface {
  name = 'EmbeddingsIvfflatIndex1720800000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE INDEX embeddings_vector_ivfflat_idx
        ON embeddings
        USING ivfflat (vector vector_cosine_ops)
        WITH (lists = 100);
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS embeddings_vector_ivfflat_idx;`);
  }
}
