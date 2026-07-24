import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase 2C: saved_searches table — user-scoped saved query + filter combos.
// Filters stored as JSONB for flexibility (space_id, template_key, tags, dept, etc.)
// ON DELETE CASCADE ensures no orphan rows when user is deleted.
export class SavedSearches1720800100000 implements MigrationInterface {
  name = 'SavedSearches1720800100000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "saved_searches" (
        "id"         BIGSERIAL PRIMARY KEY,
        "user_id"    BIGINT      NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name"       VARCHAR(200) NOT NULL,
        "query"      TEXT         NOT NULL,
        "filters"    JSONB        NOT NULL DEFAULT '{}',
        "mode"       VARCHAR(16)  NOT NULL DEFAULT 'hybrid',
        "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now()
      );
    `);

    await q.query(`CREATE INDEX "ix_saved_searches_user_id" ON "saved_searches"("user_id");`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "ix_saved_searches_user_id";`);
    await q.query(`DROP TABLE IF EXISTS "saved_searches";`);
  }
}
