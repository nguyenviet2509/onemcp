import { MigrationInterface, QueryRunner } from 'typeorm';

// Artifacts core (P3 session 1): artifacts + artifact_versions.
// Attachment table defer session 2. Review data embed trong artifact_versions.
export class Artifacts1720300000000 implements MigrationInterface {
  name = 'Artifacts1720300000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "artifacts" (
        "id" BIGSERIAL PRIMARY KEY,
        "type" VARCHAR(16) NOT NULL,
        "title" VARCHAR(255) NOT NULL,
        "slug" VARCHAR(160) NOT NULL,
        "department_id" INT NOT NULL REFERENCES "departments"("id"),
        "owner_id" INT NOT NULL REFERENCES "users"("id"),
        "current_version_id" BIGINT,
        "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
        "tags" TEXT[] NOT NULL DEFAULT '{}'::text[],
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_artifacts_dept_slug" UNIQUE ("department_id", "slug")
      );
      CREATE INDEX "ix_artifacts_status" ON "artifacts"("status");
      CREATE INDEX "ix_artifacts_type" ON "artifacts"("type");
      CREATE INDEX "ix_artifacts_tags" ON "artifacts" USING GIN ("tags");

      CREATE TABLE "artifact_versions" (
        "id" BIGSERIAL PRIMARY KEY,
        "artifact_id" BIGINT NOT NULL REFERENCES "artifacts"("id") ON DELETE CASCADE,
        "version_no" INT NOT NULL,
        "author_id" INT NOT NULL REFERENCES "users"("id"),
        "body" TEXT NOT NULL,
        "structured" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
        "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "reviewed_by" INT REFERENCES "users"("id"),
        "reviewed_at" TIMESTAMPTZ,
        "review_note" TEXT,
        CONSTRAINT "uq_artifact_version_no" UNIQUE ("artifact_id", "version_no")
      );
      CREATE INDEX "ix_artifact_versions_status" ON "artifact_versions"("status");

      ALTER TABLE "artifacts"
        ADD CONSTRAINT "fk_artifacts_current_version"
        FOREIGN KEY ("current_version_id") REFERENCES "artifact_versions"("id");
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "artifacts" DROP CONSTRAINT IF EXISTS "fk_artifacts_current_version";
      DROP TABLE IF EXISTS "artifact_versions";
      DROP TABLE IF EXISTS "artifacts";
    `);
  }
}
