import { MigrationInterface, QueryRunner } from 'typeorm';

// Attachments cho artifact. FK artifact_id (không FK version — attach ở level artifact,
// applies cho mọi version). storage_key = bucket path <artifact_id>/<uuid>-<filename>.
export class Attachments1720400000000 implements MigrationInterface {
  name = 'Attachments1720400000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "attachments" (
        "id" BIGSERIAL PRIMARY KEY,
        "artifact_id" BIGINT NOT NULL REFERENCES "artifacts"("id") ON DELETE CASCADE,
        "filename" VARCHAR(255) NOT NULL,
        "content_type" VARCHAR(128) NOT NULL,
        "size_bytes" BIGINT NOT NULL,
        "checksum_sha256" VARCHAR(64) NOT NULL,
        "storage_key" VARCHAR(512) NOT NULL,
        "uploaded_by" INT NOT NULL REFERENCES "users"("id"),
        "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_attachment_storage_key" UNIQUE ("storage_key")
      );
      CREATE INDEX "ix_attachments_artifact" ON "attachments"("artifact_id");
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "attachments";`);
  }
}
