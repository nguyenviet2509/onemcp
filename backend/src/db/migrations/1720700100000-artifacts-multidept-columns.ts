import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase 1 multi-dept: extend artifacts table for space/template/visibility tracking.
// space_id + template_key nullable — backfilled in seed migration (1720700200000).
// type column KEPT for dual-read compatibility (one release overlap, drop in Phase 2).
// Down migration drops only the added columns — does NOT restore dropped data.
export class ArtifactsMultideptColumns1720700100000 implements MigrationInterface {
  name = 'ArtifactsMultideptColumns1720700100000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "artifacts"
        ADD COLUMN IF NOT EXISTS "space_id"       BIGINT      NULL REFERENCES "spaces"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "template_key"   VARCHAR(64) NULL,
        ADD COLUMN IF NOT EXISTS "visibility"     VARCHAR(16) NOT NULL DEFAULT 'space',
        ADD COLUMN IF NOT EXISTS "view_count"     INT         NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "last_viewed_at" TIMESTAMPTZ NULL;
    `);

    await q.query(`CREATE INDEX IF NOT EXISTS "ix_artifacts_space_id"     ON "artifacts"("space_id");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_artifacts_template_key" ON "artifacts"("template_key");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_artifacts_visibility"   ON "artifacts"("visibility");`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "ix_artifacts_visibility";`);
    await q.query(`DROP INDEX IF EXISTS "ix_artifacts_template_key";`);
    await q.query(`DROP INDEX IF EXISTS "ix_artifacts_space_id";`);

    await q.query(`
      ALTER TABLE "artifacts"
        DROP COLUMN IF EXISTS "last_viewed_at",
        DROP COLUMN IF EXISTS "view_count",
        DROP COLUMN IF EXISTS "visibility",
        DROP COLUMN IF EXISTS "template_key",
        DROP COLUMN IF EXISTS "space_id";
    `);
  }
}
