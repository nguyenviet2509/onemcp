import { MigrationInterface, QueryRunner } from 'typeorm';

// OAuth 2.1 AS (parent Phase 2). Tables:
//   oauth_clients  — registered AI clients (DCR + manual)
//   oauth_consents — user's remembered consent per client
export class OauthClientConsent1722200000000 implements MigrationInterface {
  name = 'OauthClientConsent1722200000000';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS oauth_clients (
        client_id                   VARCHAR(32) PRIMARY KEY,
        client_secret_hash          VARCHAR(100),
        name                        TEXT NOT NULL,
        redirect_uris               JSONB NOT NULL,
        scopes                      JSONB NOT NULL DEFAULT '["mcp"]'::jsonb,
        token_endpoint_auth_method  VARCHAR(32) NOT NULL DEFAULT 'none',
        created_by_user_id          INTEGER,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_oauth_clients_created_by ON oauth_clients(created_by_user_id);`);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS oauth_consents (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL,
        client_id    VARCHAR(32) NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
        scopes       JSONB NOT NULL,
        granted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uniq_oauth_consent_user_client UNIQUE (user_id, client_id)
      );
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_oauth_consents_user ON oauth_consents(user_id);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_oauth_consents_client ON oauth_consents(client_id);`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS oauth_consents;`);
    await qr.query(`DROP TABLE IF EXISTS oauth_clients;`);
  }
}
