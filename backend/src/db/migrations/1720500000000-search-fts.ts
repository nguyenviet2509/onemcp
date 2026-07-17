import { MigrationInterface, QueryRunner } from 'typeorm';

// Full-text search infra (P4 part 1 — keyword only, semantic embedding defer).
// - `unaccent` extension: strip Vietnamese diacritics ("máy" → "may").
// - `pg_trgm`: fuzzy trigram match cho titles/slugs.
// - GENERATED tsvector columns trên artifact_versions.body + skill_versions.body,
//   auto-update qua STORED generated column (không cần trigger).
export class SearchFts1720500000000 implements MigrationInterface {
  name = 'SearchFts1720500000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS unaccent;`);
    await q.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    // Immutable wrapper — cần cho generated column vì unaccent mặc định là STABLE.
    await q.query(`
      CREATE OR REPLACE FUNCTION immutable_unaccent(text)
      RETURNS text AS $$
        SELECT public.unaccent('public.unaccent', $1)
      $$ LANGUAGE sql IMMUTABLE;
    `);

    await q.query(`
      ALTER TABLE "artifact_versions"
      ADD COLUMN "body_search" tsvector
      GENERATED ALWAYS AS (
        to_tsvector('simple', immutable_unaccent(COALESCE("body", '')))
      ) STORED;
    `);
    await q.query(`CREATE INDEX "ix_artifact_versions_body_search" ON "artifact_versions" USING GIN("body_search");`);

    await q.query(`
      ALTER TABLE "skill_versions"
      ADD COLUMN "body_search" tsvector
      GENERATED ALWAYS AS (
        to_tsvector('simple', immutable_unaccent(COALESCE("body", '')))
      ) STORED;
    `);
    await q.query(`CREATE INDEX "ix_skill_versions_body_search" ON "skill_versions" USING GIN("body_search");`);

    // Trigram indexes cho fuzzy title/slug match.
    await q.query(`CREATE INDEX "ix_artifacts_title_trgm" ON "artifacts" USING GIN("title" gin_trgm_ops);`);
    await q.query(`CREATE INDEX "ix_skills_name_trgm" ON "skills" USING GIN("name" gin_trgm_ops);`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "ix_skills_name_trgm";`);
    await q.query(`DROP INDEX IF EXISTS "ix_artifacts_title_trgm";`);
    await q.query(`DROP INDEX IF EXISTS "ix_skill_versions_body_search";`);
    await q.query(`DROP INDEX IF EXISTS "ix_artifact_versions_body_search";`);
    await q.query(`ALTER TABLE "skill_versions" DROP COLUMN IF EXISTS "body_search";`);
    await q.query(`ALTER TABLE "artifact_versions" DROP COLUMN IF EXISTS "body_search";`);
    await q.query(`DROP FUNCTION IF EXISTS immutable_unaccent(text);`);
    // Extensions không drop — có thể dùng chỗ khác.
  }
}
