import { MigrationInterface, QueryRunner } from 'typeorm';

// GitLab deploy tokens require a per-token username (e.g. 'gitlab+deploy-token-<n>').
// Previously the sync worker hardcoded 'oauth2' (PAT convention) → HTTP Basic 401.
// NULL falls back to 'oauth2' so legacy PAT-style rows keep working.
export class ProjectsDeployTokenUsername1722400000000 implements MigrationInterface {
  name = 'ProjectsDeployTokenUsername1722400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE projects ADD COLUMN deploy_token_username VARCHAR(128);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE projects DROP COLUMN IF EXISTS deploy_token_username;`);
  }
}
