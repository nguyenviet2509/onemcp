import { MigrationInterface, QueryRunner } from 'typeorm';

// Plan 260730-1043-openwebui-wrapup-hook — Phase 1
// UPDATE report + research templates to session-summary oriented schemas (V2).
//
// V1 fields (postmortem/methodology style) → replaced with:
//   report: context / work_done / outcome / next_steps
//   research: question / hypothesis / findings / references / conclusion
//
// These field keys match the extractor prompts defined in Phase 2 (wrapup-prompts.py).
//
// Idempotent: UPDATE only (rows already exist from migration 1720700300000).
// Safe to re-run — overwrites with same data if already applied.
//
// Down: reverts to V1 schemas (matches 1720700300000 seed state).

function toJsonbLiteral(value: unknown): string {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

interface SeedField {
  key: string;
  label: string;
  type: 'text' | 'markdown' | 'logs';
  required: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  description?: string;
}

interface TemplateUpdate {
  key: string;
  label: string;
  description: string;
  version: number;
  fields: SeedField[];
}

const UPDATES: TemplateUpdate[] = [
  {
    key: 'report',
    label: 'Session Report',
    description: 'Session outcome report — tại sao làm, làm gì, kết quả cụ thể.',
    version: 2,
    fields: [
      {
        key: 'context',
        label: 'Context',
        type: 'markdown',
        required: true,
        minLength: 50,
        placeholder: 'Tại sao làm task này? Trigger từ đâu? Background context.',
      },
      {
        key: 'work_done',
        label: 'Work done',
        type: 'markdown',
        required: true,
        minLength: 100,
        placeholder: 'Đã làm gì? Từng bước, quyết định chính, code/config thay đổi.',
      },
      {
        key: 'outcome',
        label: 'Outcome',
        type: 'markdown',
        required: true,
        minLength: 50,
        placeholder: 'Kết quả cụ thể. Metrics, trạng thái, ảnh hưởng.',
      },
      {
        key: 'next_steps',
        label: 'Next steps',
        type: 'markdown',
        required: false,
        placeholder: '- [ ] Follow-up task 1\n- [ ] Follow-up task 2',
      },
    ],
  },
  {
    key: 'research',
    label: 'Research Note',
    description: 'Research note — câu hỏi, giả thuyết, phát hiện, kết luận.',
    version: 2,
    fields: [
      {
        key: 'question',
        label: 'Research question',
        type: 'text',
        required: true,
        minLength: 20,
        maxLength: 500,
        placeholder: 'Câu hỏi cần trả lời. Cụ thể, có thể kiểm chứng.',
      },
      {
        key: 'hypothesis',
        label: 'Hypothesis',
        type: 'markdown',
        required: false,
        placeholder: 'Giả thuyết ban đầu trước khi nghiên cứu.',
      },
      {
        key: 'findings',
        label: 'Findings',
        type: 'markdown',
        required: true,
        minLength: 200,
        placeholder: 'Phát hiện chính. Data, ví dụ cụ thể, so sánh các phương án.',
      },
      {
        key: 'references',
        label: 'References',
        type: 'markdown',
        required: false,
        placeholder: '- https://link1\n- https://link2',
      },
      {
        key: 'conclusion',
        label: 'Conclusion',
        type: 'markdown',
        required: true,
        minLength: 50,
        placeholder: 'Kết luận: câu trả lời cho research question, hàm ý thực tế.',
      },
    ],
  },
];

// V1 schemas (original seed from 1720700300000) for rollback.
const V1_SCHEMAS: Record<string, { label: string; description: string; fields: SeedField[] }> = {
  report: {
    label: 'Incident Report',
    description: 'Postmortem / incident report template — capture what happened, why, how fixed.',
    fields: [
      { key: 'summary',           label: 'Summary',           type: 'markdown', required: true,  minLength: 20, maxLength: 2000, placeholder: 'What happened, in 2-3 sentences.' },
      { key: 'incident_timeline', label: 'Incident timeline', type: 'markdown', required: true,  minLength: 20, placeholder: '- 14:00 alert fired\n- 14:05 on-call ack\n- 14:15 root cause found' },
      { key: 'root_cause',        label: 'Root cause',        type: 'markdown', required: true,  minLength: 20, placeholder: 'The underlying reason.' },
      { key: 'remediation',       label: 'Remediation',       type: 'markdown', required: true,  minLength: 20, placeholder: 'What was done to fix + prevent recurrence.' },
      { key: 'action_items',      label: 'Action items',      type: 'markdown', required: false, placeholder: '- [ ] item 1 (owner, due date)' },
    ],
  },
  research: {
    label: 'Research Note',
    description: 'Research note — question, method, findings, next steps.',
    fields: [
      { key: 'question',    label: 'Research question', type: 'text',     required: true,  minLength: 10, maxLength: 500 },
      { key: 'methodology', label: 'Methodology',       type: 'markdown', required: true,  minLength: 20, placeholder: 'How were data collected / benchmark run.' },
      { key: 'findings',    label: 'Findings',          type: 'markdown', required: true,  minLength: 30 },
      { key: 'references',  label: 'References',        type: 'markdown', required: false, placeholder: '- link 1\n- link 2' },
      { key: 'next_steps',  label: 'Next steps',        type: 'markdown', required: false },
    ],
  },
};

export class UpdateReportResearchTemplatesV21722000000000 implements MigrationInterface {
  name = 'UpdateReportResearchTemplatesV21722000000000';

  async up(q: QueryRunner): Promise<void> {
    for (const t of UPDATES) {
      const schema = toJsonbLiteral({ version: t.version, fields: t.fields });
      const label = t.label.replace(/'/g, "''");
      const desc = t.description.replace(/'/g, "''");
      await q.query(`
        UPDATE "templates"
        SET
          "label"       = '${label}',
          "description" = '${desc}',
          "schema"      = ${schema},
          "active"      = true,
          "updated_at"  = now()
        WHERE "key" = '${t.key}';
      `);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    for (const [key, v1] of Object.entries(V1_SCHEMAS)) {
      const schema = toJsonbLiteral({ version: 1, fields: v1.fields });
      const label = v1.label.replace(/'/g, "''");
      const desc = v1.description.replace(/'/g, "''");
      await q.query(`
        UPDATE "templates"
        SET
          "label"       = '${label}',
          "description" = '${desc}',
          "schema"      = ${schema},
          "updated_at"  = now()
        WHERE "key" = '${key}';
      `);
    }
  }
}
