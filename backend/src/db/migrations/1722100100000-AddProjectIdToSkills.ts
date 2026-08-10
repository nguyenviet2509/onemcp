import { MigrationInterface, QueryRunner } from 'typeorm';

// P5: add nullable project_id FK on skills table for multi-project registry.
// projectId=NULL → legacy mono-repo (skills-kythuat), dept-scoped unique unchanged.
// projectId=<fk> → per-project unique enforced by partial index ux_skills_project_name.
export class AddProjectIdToSkills1722100100000 implements MigrationInterface {
  name = 'AddProjectIdToSkills1722100100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add nullable FK column
    await queryRunner.query(`
      ALTER TABLE skills
        ADD COLUMN IF NOT EXISTS project_id INT
          REFERENCES projects(id) ON DELETE SET NULL;
    `);

    // 2. Index for FK lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_skills_project_id
        ON skills(project_id);
    `);

    // 3. Partial unique index: (project_id, name) for per-project uniqueness.
    //    Legacy rows (project_id IS NULL) are excluded — existing @Unique([departmentId, name]) still covers them.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_skills_project_name
        ON skills(project_id, name)
        WHERE project_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ux_skills_project_name;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_skills_project_id;`);
    await queryRunner.query(`
      ALTER TABLE skills DROP COLUMN IF EXISTS project_id;
    `);
  }
}
