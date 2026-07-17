import { MigrationInterface, QueryRunner } from 'typeorm';

// P2: skills registry tables. Multi-tenant qua department_id.
export class Skills1720100000000 implements MigrationInterface {
  name = 'Skills1720100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE skills (
        id                  SERIAL PRIMARY KEY,
        name                VARCHAR(128) NOT NULL,
        department_id       INT NOT NULL REFERENCES departments(id),
        "repoUrl"           VARCHAR(500) NOT NULL,
        "currentVersionId"  INT,
        "ownerId"           INT,
        status              VARCHAR(16) NOT NULL DEFAULT 'active',
        description         VARCHAR(500),
        tags                TEXT[] NOT NULL DEFAULT '{}',
        "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(department_id, name)
      );
    `);
    await queryRunner.query(`CREATE INDEX ix_skills_name ON skills(name);`);
    await queryRunner.query(`CREATE INDEX ix_skills_dept ON skills(department_id);`);
    await queryRunner.query(`CREATE INDEX ix_skills_tags ON skills USING GIN(tags);`);

    await queryRunner.query(`
      CREATE TABLE skill_versions (
        id             SERIAL PRIMARY KEY,
        skill_id       INT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        "commitSha"    VARCHAR(64) NOT NULL,
        version        VARCHAR(32),
        manifest       JSONB NOT NULL,
        "approvedBy"   INT,
        "approvedAt"   TIMESTAMPTZ,
        status         VARCHAR(16) NOT NULL DEFAULT 'active',
        "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(skill_id, "commitSha")
      );
    `);
    await queryRunner.query(`CREATE INDEX ix_skill_versions_commit ON skill_versions("commitSha");`);

    // FK circular skills.currentVersionId → skill_versions.id (add after both tables exist)
    await queryRunner.query(`
      ALTER TABLE skills
      ADD CONSTRAINT fk_skills_current_version
      FOREIGN KEY ("currentVersionId") REFERENCES skill_versions(id) ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE skill_load_events (
        id                 BIGSERIAL PRIMARY KEY,
        skill_id           INT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        skill_version_id   INT NOT NULL REFERENCES skill_versions(id) ON DELETE CASCADE,
        "userId"           INT,
        username           VARCHAR(64),
        ip                 VARCHAR(64),
        ts                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX ix_load_events_skill_ts ON skill_load_events(skill_id, ts DESC);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE skills DROP CONSTRAINT IF EXISTS fk_skills_current_version;`);
    await queryRunner.query(`DROP TABLE IF EXISTS skill_load_events;`);
    await queryRunner.query(`DROP TABLE IF EXISTS skill_versions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS skills;`);
  }
}
