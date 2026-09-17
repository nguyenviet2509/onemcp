import { MigrationInterface, QueryRunner } from 'typeorm';

// Registry tables for tool_upstreams (upstream HTTP APIs) and tool_bridges
// (bridge configs mapping tool calls → upstream endpoints).
// bearer_ciphertext: AES-256-GCM via TokenCipherService (never plaintext in DB).
// FK ON DELETE RESTRICT: prevents orphaned bridges if upstream removed.
export class ToolBridgesRegistry1722600000000 implements MigrationInterface {
  name = 'ToolBridgesRegistry1722600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE tool_upstreams (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name            VARCHAR(64) UNIQUE NOT NULL,
        base_url        VARCHAR(512) NOT NULL,
        bearer_ciphertext TEXT NOT NULL,
        timeout_ms      INT NOT NULL DEFAULT 10000,
        enabled         BOOLEAN NOT NULL DEFAULT true,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await q.query(`
      CREATE TABLE tool_bridges (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        upstream_id     UUID NOT NULL REFERENCES tool_upstreams(id) ON DELETE RESTRICT,
        name            VARCHAR(64) UNIQUE NOT NULL,
        description     TEXT NOT NULL,
        method          VARCHAR(8) NOT NULL CHECK (method IN ('GET','POST','PUT','DELETE')),
        path            VARCHAR(512) NOT NULL,
        param_schema    JSONB NOT NULL,
        permission_id   VARCHAR(128) NOT NULL,
        enabled         BOOLEAN NOT NULL DEFAULT true,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await q.query(`CREATE INDEX idx_tool_bridges_upstream ON tool_bridges(upstream_id)`);
    await q.query(`CREATE INDEX idx_tool_bridges_enabled ON tool_bridges(enabled) WHERE enabled = true`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS tool_bridges`);
    await q.query(`DROP TABLE IF EXISTS tool_upstreams`);
  }
}
