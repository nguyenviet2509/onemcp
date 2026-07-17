import { MigrationInterface, QueryRunner } from 'typeorm';

// V1 — Thêm cột service TEXT vào artifacts cho runbook type (RT-3 + Validation V1).
// Populated khi submit type=runbook từ template field 'service'. Existing rows backfill NULL.
export class ArtifactsServiceColumn1720600100000 implements MigrationInterface {
  name = 'ArtifactsServiceColumn1720600100000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "artifacts"
        ADD COLUMN IF NOT EXISTS "service" TEXT;

      CREATE INDEX IF NOT EXISTS "ix_artifacts_service"
        ON "artifacts" ("service");
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP INDEX IF EXISTS "ix_artifacts_service";
      ALTER TABLE "artifacts" DROP COLUMN IF EXISTS "service";
    `);
  }
}
