import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase 1 multi-dept: spaces, templates, api_keys tables.
// spaces: workspace per department, slug unique, visibility scoped.
// templates: DB-driven template registry (replaces hardcoded template-registry.ts).
// api_keys: per-user API key (bcrypt hash), prefix-indexed for fast lookup.
export class SpacesTemplatesApiKeys1720700000000 implements MigrationInterface {
  name = 'SpacesTemplatesApiKeys1720700000000';

  async up(q: QueryRunner): Promise<void> {
    // spaces
    await q.query(`
      CREATE TABLE "spaces" (
        "id"            BIGSERIAL PRIMARY KEY,
        "slug"          VARCHAR(64) NOT NULL,
        "name"          TEXT NOT NULL,
        "description"   TEXT,
        "department_id" BIGINT REFERENCES "departments"("id") ON DELETE SET NULL,
        "icon"          VARCHAR(32),
        "visibility"    VARCHAR(16) NOT NULL DEFAULT 'space',
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_spaces_slug" UNIQUE ("slug")
      );
    `);
    await q.query(`CREATE INDEX "ix_spaces_department_id" ON "spaces"("department_id");`);

    // templates — key is PK (e.g. 'report', 'kb', 'runbook', 'sop', ...)
    await q.query(`
      CREATE TABLE "templates" (
        "key"               VARCHAR(64) PRIMARY KEY,
        "label"             TEXT NOT NULL,
        "description"       TEXT,
        "schema"            JSONB NOT NULL DEFAULT '{}'::jsonb,
        "ui_hints"          JSONB,
        "department_scope"  TEXT[] NOT NULL DEFAULT '{}'::text[],
        "active"            BOOL NOT NULL DEFAULT true,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await q.query(`CREATE INDEX "ix_templates_active" ON "templates"("active");`);

    // api_keys — hash stored, key_prefix indexed for O(1) lookup
    await q.query(`
      CREATE TABLE "api_keys" (
        "id"           BIGSERIAL PRIMARY KEY,
        "user_id"      BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "key_hash"     TEXT NOT NULL,
        "key_prefix"   VARCHAR(16) NOT NULL,
        "label"        TEXT,
        "last_used_at" TIMESTAMPTZ,
        "expires_at"   TIMESTAMPTZ,
        "revoked"      BOOL NOT NULL DEFAULT false,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_api_keys_prefix" UNIQUE ("key_prefix")
      );
    `);
    await q.query(`CREATE INDEX "ix_api_keys_user_id" ON "api_keys"("user_id");`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "api_keys";`);
    await q.query(`DROP TABLE IF EXISTS "templates";`);
    await q.query(`DROP TABLE IF EXISTS "spaces";`);
  }
}
