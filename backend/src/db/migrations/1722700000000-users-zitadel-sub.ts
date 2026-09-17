import { MigrationInterface, QueryRunner } from 'typeorm';

// Add zitadel_sub column to users table for Zitadel identity correlation.
// Used by bridge tools to forward X-Onemcp-User-Sub header for distributed RBAC.
// Column optional (nullable) — populated by ZitadelJwtMiddleware on login,
// legacy trust-header users have NULL (blocked from bridge tools via Path C guard).
export class UsersZitadelSub1722700000000 implements MigrationInterface {
  name = 'UsersZitadelSub1722700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS zitadel_sub VARCHAR(256) NULL
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_users_zitadel_sub ON users(zitadel_sub) WHERE zitadel_sub IS NOT NULL
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS idx_users_zitadel_sub`);
    await q.query(`ALTER TABLE users DROP COLUMN IF EXISTS zitadel_sub`);
  }
}
