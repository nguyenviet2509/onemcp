import { MigrationInterface, QueryRunner } from 'typeorm';

// Initial schema for OneMCP v1 — multi-tenant ready (department_id NOT NULL khắp nơi).
export class Init1720000000000 implements MigrationInterface {
  name = 'Init1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // departments
    await queryRunner.query(`
      CREATE TABLE departments (
        id           SERIAL PRIMARY KEY,
        code         VARCHAR(64) NOT NULL,
        name         VARCHAR(200) NOT NULL,
        "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX ix_departments_code ON departments(code);`);

    // roles
    await queryRunner.query(`
      CREATE TABLE roles (
        id          SERIAL PRIMARY KEY,
        code        VARCHAR(32) NOT NULL,
        description VARCHAR(200)
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX ix_roles_code ON roles(code);`);

    // users — inet_sub/gitlab_id NULLABLE (auth defer plan populate sau)
    await queryRunner.query(`
      CREATE TABLE users (
        id             SERIAL PRIMARY KEY,
        username       VARCHAR(64) NOT NULL,
        "inetSub"      VARCHAR(128),
        "gitlabId"     VARCHAR(64),
        email          VARCHAR(200),
        "displayName"  VARCHAR(200),
        department_id  INT NOT NULL REFERENCES departments(id),
        status         VARCHAR(16) NOT NULL DEFAULT 'active',
        "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX ix_users_username ON users(username);`);
    await queryRunner.query(`CREATE INDEX ix_users_dept ON users(department_id);`);

    // user_roles — scoped by dept
    await queryRunner.query(`
      CREATE TABLE user_roles (
        id             SERIAL PRIMARY KEY,
        user_id        INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id        INT NOT NULL REFERENCES roles(id),
        department_id  INT NOT NULL REFERENCES departments(id),
        UNIQUE(user_id, role_id, department_id)
      );
    `);

    // audit_events — append-only
    await queryRunner.query(`
      CREATE TABLE audit_events (
        id                BIGSERIAL PRIMARY KEY,
        "actorUserId"     INT,
        "actorUsername"   VARCHAR(64),
        action            VARCHAR(64) NOT NULL,
        "resourceType"    VARCHAR(64),
        "resourceId"      VARCHAR(128),
        before            JSONB,
        after             JSONB,
        ip                VARCHAR(64),
        "sessionId"       VARCHAR(128),
        ts                TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX ix_audit_action_ts ON audit_events(action, ts DESC);`);
    await queryRunner.query(`CREATE INDEX ix_audit_actor_ts ON audit_events("actorUsername", ts DESC);`);

    // Seed: departments
    await queryRunner.query(`
      INSERT INTO departments (code, name) VALUES ('kythuat', 'Kỹ thuật');
    `);

    // Seed: roles (5 role codes chuẩn)
    await queryRunner.query(`
      INSERT INTO roles (code, description) VALUES
        ('viewer',      'Read-only access'),
        ('contributor', 'Submit artifacts + skills, pending review'),
        ('maintainer',  'Approve/reject artifacts + skills in own department'),
        ('dept-admin',  'Manage users + roles trong department'),
        ('super-admin', 'Full access all departments + system config');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Down phải reverse thứ tự dependency.
    await queryRunner.query(`DROP TABLE IF EXISTS audit_events;`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_roles;`);
    await queryRunner.query(`DROP TABLE IF EXISTS users;`);
    await queryRunner.query(`DROP TABLE IF EXISTS roles;`);
    await queryRunner.query(`DROP TABLE IF EXISTS departments;`);
  }
}
