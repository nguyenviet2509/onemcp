import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase 4 v1.5 — Seed 3 additional spaces for Ops and Support departments.
// Spaces: ops-runbook, ops-oncall, support-faq
//
// Strategy:
//   - Look up department_id by code ('ops' or 'support'). If dept not found, log warning and
//     insert space with department_id = NULL and visibility = 'cross_dept' as fallback.
//   - ON CONFLICT (slug) DO NOTHING — idempotent.
//
// Down: DELETE the 3 spaces by slug.

interface SpaceSeed {
  slug: string;
  name: string;
  description: string;
  deptCode: string;
}

const SPACES: SpaceSeed[] = [
  {
    slug: 'ops-runbook',
    name: 'Ops — Runbooks',
    description: 'Runbook và SOP vận hành cho Ops team. Tra khi oncall hoặc xử lý incident.',
    deptCode: 'ops',
  },
  {
    slug: 'ops-oncall',
    name: 'Ops — On-Call',
    description: 'Tài liệu oncall: escalation matrix, handoff checklist, alert playbook.',
    deptCode: 'ops',
  },
  {
    slug: 'support-faq',
    name: 'Support — FAQ & Playbooks',
    description: 'FAQ chuẩn + ticket playbook cho Support team. Tra nhanh khi xử lý ticket khách.',
    deptCode: 'support',
  },
];

export class SeedOpsSupportSpaces1720900100000 implements MigrationInterface {
  name = 'SeedOpsSupportSpaces1720900100000';

  async up(q: QueryRunner): Promise<void> {
    for (const s of SPACES) {
      // Look up the department. If not found, fallback to cross_dept space with NULL dept.
      const deptRows = await q.query(
        `SELECT "id" FROM "departments" WHERE "code" = $1 LIMIT 1`,
        [s.deptCode],
      );

      const deptId: number | null = deptRows.length > 0 ? deptRows[0].id : null;
      const visibility = deptId ? 'space' : 'cross_dept';

      if (!deptId) {
        console.warn(
          `[SeedOpsSupportSpaces] dept code='${s.deptCode}' not found — ` +
            `inserting space '${s.slug}' with department_id=NULL, visibility='cross_dept'`,
        );
      }

      const desc = s.description.replace(/'/g, "''");
      const name = s.name.replace(/'/g, "''");

      await q.query(`
        INSERT INTO "spaces" ("slug", "name", "description", "department_id", "visibility", "created_at", "updated_at")
        VALUES (
          '${s.slug}',
          '${name}',
          '${desc}',
          ${deptId !== null ? deptId : 'NULL'},
          '${visibility}',
          now(),
          now()
        )
        ON CONFLICT ("slug") DO NOTHING;
      `);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    const slugs = SPACES.map((s) => `'${s.slug}'`).join(', ');
    await q.query(`DELETE FROM "spaces" WHERE "slug" IN (${slugs});`);
  }
}
