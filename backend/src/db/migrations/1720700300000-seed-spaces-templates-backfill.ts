import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase 1 seed + backfill — runs after schema migrations (1720700000000–1720700200000).
//
// 1. Spaces: 1 space per existing department, slug = department.code (departments use 'code' not 'slug').
// 2. Templates: port all 5 entries from hardcoded template-registry.ts + 3 new (sop, faq, ticket_playbook).
//    schema JSONB mirrors TemplateField[] structure; ui_hints left {} placeholder (real schema Phase 2).
// 3. Backfill artifacts:
//    - space_id     ← default space for the artifact's department
//    - template_key ← type::text (dual-read bridge; type column kept for 1 release)
//
// Down: removes seeded rows only — schema columns dropped by their own migrations.

// Helper: serialize a value to a SQL-safe JSONB literal (single-quoted, inner single-quotes escaped).
function toJsonbLiteral(value: unknown): string {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

// TemplateField shape (mirrors template-registry.ts — no external import needed here).
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

interface SeedTemplate {
  key: string;
  label: string;
  description: string;
  fields: SeedField[];
}

// All 5 existing templates + 3 new ones.
const SEED_TEMPLATES: SeedTemplate[] = [
  {
    key: 'report',
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
  {
    key: 'research',
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
  {
    key: 'kb',
    label: 'Knowledge Base Entry',
    description: 'Knowledge-base entry — problem + solution.',
    fields: [
      { key: 'problem',  label: 'Problem / symptoms', type: 'markdown', required: true,  minLength: 15, placeholder: 'Error message or symptom that a future dev will paste when searching.' },
      { key: 'solution', label: 'Solution',           type: 'markdown', required: true,  minLength: 30, placeholder: 'Step-by-step fix. Include commands + code snippets.' },
      { key: 'related',  label: 'Related resources',  type: 'markdown', required: false, placeholder: '- link toi runbook\n- link toi artifact khac' },
    ],
  },
  {
    key: 'postmortem',
    label: 'Post-mortem',
    description: 'Ops post-mortem — 4 required fields, optional fields de khong can ops 2am.',
    fields: [
      { key: 'summary',         label: 'Summary',           type: 'markdown', required: true,  placeholder: 'What happened — 2-3 cau mo ta su co.' },
      { key: 'timeline',        label: 'Timeline',          type: 'markdown', required: true,  placeholder: '- HH:MM - Event\n- HH:MM - Root cause identified' },
      { key: 'root_cause',      label: 'Root Cause',        type: 'markdown', required: true,  placeholder: 'Nguyen nhan goc re. 5-whys neu can.' },
      { key: 'action_items',    label: 'Action Items',      type: 'markdown', required: true,  placeholder: '- [ ] Fix X (owner: @user, due: YYYY-MM-DD)' },
      { key: 'severity',        label: 'Severity',          type: 'text',     required: false, placeholder: 'SEV1 / SEV2 / SEV3' },
      { key: 'incident_id',     label: 'Incident ID',       type: 'text',     required: false, placeholder: 'INC-20260717-1' },
      { key: 'date_occurred',   label: 'Date Occurred',     type: 'text',     required: false, placeholder: '2026-07-17' },
      { key: 'duration_minutes',label: 'Duration (minutes)',type: 'text',     required: false, placeholder: '45' },
      { key: 'blast_radius',    label: 'Blast Radius',      type: 'markdown', required: false, placeholder: 'Services + user impact.' },
      { key: 'remediation',     label: 'Remediation',       type: 'markdown', required: false, placeholder: 'Fix cu the da lam.' },
      { key: 'detection_gap',   label: 'Detection Gap',     type: 'markdown', required: false, placeholder: 'Tai sao khong phat hien som hon?' },
      { key: 'lessons_learned', label: 'Lessons Learned',   type: 'markdown', required: false },
      { key: 'raw_logs',        label: 'Raw Logs',          type: 'logs',     required: false, description: 'Log lien quan den su co.' },
    ],
  },
  {
    key: 'runbook',
    label: 'Runbook',
    description: 'Operational runbook — symptoms to verify to mitigate to escalate. Goi load_runbook khi paged.',
    fields: [
      { key: 'service',            label: 'Service',                       type: 'text',     required: true,  placeholder: 'postgres | redis | nginx | backend', description: 'Ten service lien quan. Luu vao cot artifacts.service.' },
      { key: 'symptoms',           label: 'Symptoms',                      type: 'markdown', required: true,  placeholder: 'Alert signals + observable symptoms.' },
      { key: 'verify_command',     label: 'Verify Commands',               type: 'markdown', required: true,  placeholder: 'Commands to verify the issue.' },
      { key: 'mitigation_steps',   label: 'Mitigation Steps',              type: 'markdown', required: true,  placeholder: '1. Step 1\n2. Step 2' },
      { key: 'verification_after', label: 'Verification After Mitigation', type: 'markdown', required: true,  placeholder: 'Commands + expected output.' },
      { key: 'escalation_path',    label: 'Escalation Path',               type: 'markdown', required: true,  placeholder: '1. On-call SRE\n2. Team Lead\n3. CTO' },
      { key: 'related_alerts',     label: 'Related Alerts',                type: 'text',     required: false, placeholder: 'DiskFull,PostgresOOM (comma-separated)' },
      { key: 'severity_impact',    label: 'Severity Impact',               type: 'markdown', required: false, placeholder: 'SEV1: full outage\nSEV2: degraded' },
    ],
  },
  // 3 new templates for Phase 1 multi-dept
  {
    key: 'sop',
    label: 'Standard Operating Procedure',
    description: 'Step-by-step procedure for recurring operational tasks.',
    fields: [
      { key: 'purpose',       label: 'Purpose',       type: 'markdown', required: true,  placeholder: 'What this SOP covers and when to use it.' },
      { key: 'prerequisites', label: 'Prerequisites', type: 'markdown', required: false, placeholder: 'Access, tools, or environment requirements.' },
      { key: 'steps',         label: 'Steps',         type: 'markdown', required: true,  placeholder: '1. Step one\n2. Step two\n3. Verify outcome' },
      { key: 'verification',  label: 'Verification',  type: 'markdown', required: false, placeholder: 'How to confirm the procedure completed successfully.' },
      { key: 'rollback',      label: 'Rollback',      type: 'markdown', required: false, placeholder: 'Steps to undo if something goes wrong.' },
      { key: 'notes',         label: 'Notes',         type: 'markdown', required: false },
    ],
  },
  {
    key: 'faq',
    label: 'FAQ',
    description: 'Frequently asked questions — question/answer pairs for common issues.',
    fields: [
      { key: 'context', label: 'Context / Audience', type: 'text',     required: false, placeholder: 'Who this FAQ is for (e.g. new devs, ops team).' },
      { key: 'entries', label: 'Q&A Entries',        type: 'markdown', required: true,  placeholder: '## Q: How do I restart the service?\n**A:** Run restart command.' },
      { key: 'related', label: 'Related Resources',  type: 'markdown', required: false, placeholder: '- Runbook link\n- Onboarding doc link' },
    ],
  },
  {
    key: 'ticket_playbook',
    label: 'Ticket Playbook',
    description: 'Decision tree / checklist for triaging and resolving support tickets.',
    fields: [
      { key: 'ticket_type',    label: 'Ticket Type',    type: 'text',     required: true,  placeholder: 'e.g. login-failure, slow-query, data-loss' },
      { key: 'triage_steps',   label: 'Triage Steps',   type: 'markdown', required: true,  placeholder: '1. Confirm symptom\n2. Check dashboard X\n3. Query Y' },
      { key: 'resolution',     label: 'Resolution',     type: 'markdown', required: true,  placeholder: 'Known fixes per symptom variant.' },
      { key: 'escalation',     label: 'Escalation',     type: 'markdown', required: false, placeholder: 'When to escalate and to whom.' },
      { key: 'customer_comms', label: 'Customer Comms', type: 'markdown', required: false, placeholder: 'Template response to send to affected users.' },
    ],
  },
];

export class SeedSpacesTemplatesBackfill1720700300000 implements MigrationInterface {
  name = 'SeedSpacesTemplatesBackfill1720700300000';

  async up(q: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------ spaces
    // Insert 1 space per department; slug = department.code (unique per init migration).
    await q.query(`
      INSERT INTO "spaces" ("slug", "name", "department_id", "visibility", "created_at", "updated_at")
      SELECT
        d."code"  AS slug,
        d."name"  AS name,
        d."id"    AS department_id,
        'space'   AS visibility,
        now()     AS created_at,
        now()     AS updated_at
      FROM "departments" d
      ON CONFLICT ("slug") DO NOTHING;
    `);

    // ------------------------------------------------------------------ templates
    // Insert each template as a separate query to avoid dollar-quoting conflicts in TS.
    for (const t of SEED_TEMPLATES) {
      const schema = toJsonbLiteral({ version: 1, fields: t.fields });
      const desc = t.description.replace(/'/g, "''");
      const label = t.label.replace(/'/g, "''");
      await q.query(`
        INSERT INTO "templates" ("key", "label", "description", "schema", "ui_hints", "active")
        VALUES (
          '${t.key}',
          '${label}',
          '${desc}',
          ${schema},
          '{}'::jsonb,
          true
        )
        ON CONFLICT ("key") DO NOTHING;
      `);
    }

    // ------------------------------------------------------------------ backfill artifacts
    // Set space_id to the default space for each artifact's department.
    await q.query(`
      UPDATE "artifacts" a
      SET "space_id" = s."id"
      FROM "spaces" s
      WHERE s."department_id" = a."department_id"
        AND a."space_id" IS NULL;
    `);

    // Set template_key from existing type column (dual-read bridge).
    await q.query(`
      UPDATE "artifacts"
      SET "template_key" = "type"
      WHERE "template_key" IS NULL;
    `);

    // Verify: post-migration both counts should be 0.
    // SELECT count(*) FROM artifacts WHERE space_id IS NULL;
    // SELECT count(*) FROM artifacts WHERE template_key IS NULL;
  }

  async down(q: QueryRunner): Promise<void> {
    // Clear backfill values (restore nullable state).
    await q.query(`UPDATE "artifacts" SET "template_key" = NULL, "space_id" = NULL;`);

    // Remove seeded templates.
    const keys = SEED_TEMPLATES.map((t) => `'${t.key}'`).join(', ');
    await q.query(`DELETE FROM "templates" WHERE "key" IN (${keys});`);

    // Remove seeded spaces (only those seeded from departments — matched by slug = department.code).
    await q.query(`
      DELETE FROM "spaces" s
      USING "departments" d
      WHERE s."slug" = d."code"
        AND s."department_id" = d."id";
    `);
  }
}
