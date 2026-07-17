import { MigrationInterface, QueryRunner } from 'typeorm';

// Create alertmanager_dedup table for Postgres-backed alert deduplication (RT-7).
// fingerprint TEXT PRIMARY KEY — server-computed sha256, never client-supplied groupKey.
// ts TIMESTAMPTZ — creation time, indexed for efficient TTL pruning.
// alertname TEXT — stored for observability / debugging only.
// TTL: rows older than ALERTMANAGER_DEDUP_TTL_MIN (default 240 min) pruned opportunistically.
export class AlertmanagerDedup1720600300000 implements MigrationInterface {
  name = 'AlertmanagerDedup1720600300000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "alertmanager_dedup" (
        "fingerprint"  TEXT        NOT NULL,
        "ts"           TIMESTAMPTZ NOT NULL DEFAULT now(),
        "alertname"    TEXT,
        CONSTRAINT "pk_alertmanager_dedup" PRIMARY KEY ("fingerprint")
      );

      CREATE INDEX IF NOT EXISTS "ix_alertmanager_dedup_ts"
        ON "alertmanager_dedup" ("ts");
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP TABLE IF EXISTS "alertmanager_dedup";
    `);
  }
}
