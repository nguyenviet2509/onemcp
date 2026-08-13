import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase 1: per-project default branch (was hardcoded 'main' in sync worker).
// Fixes sync failure on repos whose default branch is 'master' / 'develop' / etc.
export class ProjectsBranch1722300000000 implements MigrationInterface {
  name = 'ProjectsBranch1722300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE projects ADD COLUMN branch VARCHAR(64) NOT NULL DEFAULT 'main';`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE projects DROP COLUMN IF EXISTS branch;`);
  }
}
