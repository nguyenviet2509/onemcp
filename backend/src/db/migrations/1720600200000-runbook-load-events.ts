import { MigrationInterface, QueryRunner } from 'typeorm';

// Audit table cho runbook load events (RT-15 + Validation V1).
// IP lưu dạng ip_hash (sha256) — không lưu raw IP để tránh PII.
// Retention: nightly cron DELETE WHERE ts < now() - interval RUNBOOK_EVENTS_RETAIN_DAYS days (default 90).
export class RunbookLoadEvents1720600200000 implements MigrationInterface {
  name = 'RunbookLoadEvents1720600200000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "runbook_load_events" (
        "id"                  SERIAL PRIMARY KEY,
        "artifact_id"         BIGINT REFERENCES "artifacts"("id") ON DELETE SET NULL,
        "artifact_version_id" BIGINT REFERENCES "artifact_versions"("id") ON DELETE SET NULL,
        "user_id"             TEXT,
        "ts"                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "ip_hash"             TEXT
      );

      CREATE INDEX IF NOT EXISTS "ix_runbook_load_events_artifact_ts"
        ON "runbook_load_events" ("artifact_id", "ts");

      CREATE INDEX IF NOT EXISTS "ix_runbook_load_events_ts"
        ON "runbook_load_events" ("ts");
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP TABLE IF EXISTS "runbook_load_events";
    `);
  }
}
