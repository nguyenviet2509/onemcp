import { MigrationInterface, QueryRunner } from 'typeorm';

// P4: multi-project registry. Each project = git repo hosting skills.
// Legacy skills-kythuat implicit project (projectId=null on skills rows) is handled at app layer — no FK backfill here.
export class Projects1722100000000 implements MigrationInterface {
  name = 'Projects1722100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE projects (
        id                SERIAL PRIMARY KEY,
        slug              VARCHAR(64)  NOT NULL,
        name              TEXT         NOT NULL,
        description       TEXT,
        git_repo_url      VARCHAR(500) NOT NULL,
        deploy_token_enc  BYTEA,
        scope             VARCHAR(16)  NOT NULL DEFAULT 'private',
        department_id     INT          REFERENCES departments(id) ON DELETE SET NULL,
        owner_id          INT          REFERENCES users(id)       ON DELETE SET NULL,
        webhook_secret    VARCHAR(128) NOT NULL,
        status            VARCHAR(16)  NOT NULL DEFAULT 'pending',
        approved_at       TIMESTAMPTZ,
        approved_by       INT          REFERENCES users(id)       ON DELETE SET NULL,
        rejected_reason   TEXT,
        created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        UNIQUE(slug),
        UNIQUE(webhook_secret)
      );
    `);

    await queryRunner.query(`CREATE INDEX ix_projects_slug       ON projects(slug);`);
    await queryRunner.query(`CREATE INDEX ix_projects_dept       ON projects(department_id);`);
    await queryRunner.query(`CREATE INDEX ix_projects_status     ON projects(status);`);
    await queryRunner.query(`CREATE INDEX ix_projects_scope      ON projects(scope);`);
    await queryRunner.query(`CREATE INDEX ix_projects_owner      ON projects(owner_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS projects;`);
  }
}
