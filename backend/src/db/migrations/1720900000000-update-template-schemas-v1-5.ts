import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase 4 v1.5 — UPDATE 3 placeholder templates (sop, faq, ticket_playbook) with real schemas.
// Phase 1 seeded these with schema={} and ui_hints={}.
// This migration fills in:
//   schema: { required[], optional[], field_labels{} }  — Vietnamese labels for Ops/Support users
//   ui_hints: kept minimal (empty object — reserved for future form hints)
//   label: Vietnamese-friendly name
//   description: short Vietnamese description
//   active: true (ensure visible in template picker)
//
// Idempotent: UPDATE only — no INSERT. Safe to rerun.
// Down: reverts all 3 back to schema={} (matches Phase 1 backfill state).

function toJsonbLiteral(value: unknown): string {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

interface TemplateUpdate {
  key: string;
  label: string;
  description: string;
  schema: {
    required: string[];
    optional: string[];
    field_labels: Record<string, string>;
  };
}

const UPDATES: TemplateUpdate[] = [
  {
    key: 'sop',
    label: 'SOP - Quy trình vận hành',
    description: 'Mô tả từng bước quy trình lặp lại cho Ops/Support.',
    schema: {
      required: ['audience', 'purpose', 'steps'],
      optional: ['prerequisites', 'related_sop', 'owner'],
      field_labels: {
        audience: 'Đối tượng áp dụng (Ops L1/L2, Support...)',
        purpose: 'Mục đích',
        steps: 'Các bước thực hiện (đánh số)',
        prerequisites: 'Điều kiện tiên quyết',
        related_sop: 'SOP liên quan',
        owner: 'Người duy trì',
      },
    },
  },
  {
    key: 'faq',
    label: 'FAQ - Câu hỏi thường gặp',
    description: 'Cặp hỏi-đáp chuẩn cho Support team tra nhanh khi xử lý ticket.',
    schema: {
      required: ['question', 'answer'],
      optional: ['category', 'related_questions', 'escalation'],
      field_labels: {
        question: 'Câu hỏi khách hàng',
        answer: 'Câu trả lời chuẩn',
        category: 'Nhóm (billing, technical, account...)',
        related_questions: 'Câu hỏi tương tự',
        escalation: 'Khi nào escalate',
      },
    },
  },
  {
    key: 'ticket_playbook',
    label: 'Ticket Playbook - Hướng xử lý ticket',
    description: 'Cây quyết định + checklist để triage và resolve support ticket.',
    schema: {
      required: ['ticket_type', 'diagnostic_steps', 'resolution_options'],
      optional: ['severity', 'sla', 'escalation_matrix', 'communication_template'],
      field_labels: {
        ticket_type: 'Loại ticket',
        diagnostic_steps: 'Bước chẩn đoán',
        resolution_options: 'Các phương án xử lý',
        severity: 'Mức độ',
        sla: 'SLA cam kết',
        escalation_matrix: 'Ma trận escalate',
        communication_template: 'Mẫu communication khách',
      },
    },
  },
];

export class UpdateTemplateSchemasV151720900000000 implements MigrationInterface {
  name = 'UpdateTemplateSchemasV151720900000000';

  async up(q: QueryRunner): Promise<void> {
    for (const t of UPDATES) {
      const schema = toJsonbLiteral(t.schema);
      const label = t.label.replace(/'/g, "''");
      const desc = t.description.replace(/'/g, "''");
      await q.query(`
        UPDATE "templates"
        SET
          "label"       = '${label}',
          "description" = '${desc}',
          "schema"      = ${schema},
          "ui_hints"    = '{}'::jsonb,
          "active"      = true,
          "updated_at"  = now()
        WHERE "key" = '${t.key}';
      `);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    // Revert to Phase 1 placeholder state (schema={}, ui_hints={}).
    const keys = UPDATES.map((t) => `'${t.key}'`).join(', ');
    await q.query(`
      UPDATE "templates"
      SET "schema" = '{}'::jsonb, "ui_hints" = '{}'::jsonb, "updated_at" = now()
      WHERE "key" IN (${keys});
    `);
  }
}
