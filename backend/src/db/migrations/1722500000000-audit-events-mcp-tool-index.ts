import { MigrationInterface, QueryRunner } from 'typeorm';

// Composite index cho query "user X trong 24h gọi tool nào" (Phase 07 portal audit view).
// CONCURRENTLY để không lock audit_events (có thể lớn ở prod).
// F4 red-team fix: pre-check + post-verify indisvalid — nếu index bị INVALID (do
// migration bị SIGKILL giữa chừng lần trước, IF NOT EXISTS mask lỗi), DROP + retry.
// F8 red-team fix: assert audit_events table exists (fresh install safety).
export class AuditEventsMcpToolIndex1722500000000 implements MigrationInterface {
  name = 'AuditEventsMcpToolIndex1722500000000';
  // CONCURRENTLY không chạy được trong transaction.
  transaction = false as const;

  public async up(q: QueryRunner): Promise<void> {
    // F8: fresh install safety — audit_events phải tồn tại trước
    const tableExists = await q.query(`SELECT to_regclass('public.audit_events') AS t`);
    if (!tableExists[0]?.t) {
      throw new Error('audit_events table missing — check migration order');
    }

    // F4 pre-check: nếu index tồn tại nhưng INVALID (partial CREATE trước đó) → DROP
    const existing = await q.query(`
      SELECT indisvalid FROM pg_index
      WHERE indexrelid = to_regclass('public.audit_events_actor_action_ts_idx')
    `);
    if (existing.length > 0 && existing[0].indisvalid === false) {
      await q.query(`DROP INDEX CONCURRENTLY IF EXISTS audit_events_actor_action_ts_idx`);
    }

    // NOTE: audit_events columns are camelCase-quoted in Postgres (TypeORM default
    // when no naming strategy is set). Quote them explicitly.
    await q.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_events_actor_action_ts_idx
      ON audit_events ("actorUsername", action, ts DESC)
    `);

    // F4 post-verify: nếu build xong nhưng INVALID → fail migration để ops fix
    const verify = await q.query(`
      SELECT indisvalid FROM pg_index
      WHERE indexrelid = to_regclass('public.audit_events_actor_action_ts_idx')
    `);
    if (!verify[0]?.indisvalid) {
      throw new Error('audit_events_actor_action_ts_idx built but INVALID — investigate manually');
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX CONCURRENTLY IF EXISTS audit_events_actor_action_ts_idx`);
  }
}
