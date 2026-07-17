import { MigrationInterface, QueryRunner } from 'typeorm';

// Add body column (SKILL.md content) to skill_versions.
// Cho phép MCP load_skill trả về content trực tiếp từ DB, không cần
// call git mirror mỗi lần (giảm latency + tách phụ thuộc GitLab).
export class SkillVersionBody1720200000000 implements MigrationInterface {
  name = 'SkillVersionBody1720200000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "skill_versions" ADD COLUMN "body" text`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "skill_versions" DROP COLUMN "body"`);
  }
}
