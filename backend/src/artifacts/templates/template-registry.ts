import { ArtifactType } from '../artifact-type.enum';

// Template = danh sách sections bắt buộc/optional per artifact type.
// Structured JSONB lưu {key: content} theo template. Body auto-compile.
// Schema đơn giản (không dùng full JSON Schema) — YAGNI cho pilot.

export interface TemplateField {
  key: string; // Snake case, unique trong template.
  label: string; // UI label.
  type: 'text' | 'markdown' | 'logs'; // 'logs' compile to ```log fence block (V7).
  required: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  description?: string;
}

export interface Template {
  type: ArtifactType;
  version: number; // Bump khi thay đổi structure — cho migration về sau.
  description: string;
  fields: TemplateField[];
}

const REPORT: Template = {
  type: 'report',
  version: 1,
  description: 'Postmortem / incident report template — capture what happened, why, how fixed.',
  fields: [
    { key: 'summary', label: 'Summary', type: 'markdown', required: true, minLength: 20, maxLength: 2000, placeholder: 'What happened, in 2-3 sentences.' },
    { key: 'incident_timeline', label: 'Incident timeline', type: 'markdown', required: true, minLength: 20, placeholder: '- 14:00 alert fired\n- 14:05 on-call ack\n- 14:15 root cause found\n- 14:30 mitigation applied' },
    { key: 'root_cause', label: 'Root cause', type: 'markdown', required: true, minLength: 20, placeholder: 'The underlying reason. Include why previous safeguards did not catch it.' },
    { key: 'remediation', label: 'Remediation', type: 'markdown', required: true, minLength: 20, placeholder: 'What was done to fix + prevent recurrence.' },
    { key: 'action_items', label: 'Action items', type: 'markdown', required: false, placeholder: '- [ ] item 1 (owner, due date)\n- [ ] item 2' },
  ],
};

const RESEARCH: Template = {
  type: 'research',
  version: 1,
  description: 'Research note — question, method, findings, next steps.',
  fields: [
    { key: 'question', label: 'Research question', type: 'text', required: true, minLength: 10, maxLength: 500 },
    { key: 'methodology', label: 'Methodology', type: 'markdown', required: true, minLength: 20, placeholder: 'How were data collected / benchmark run.' },
    { key: 'findings', label: 'Findings', type: 'markdown', required: true, minLength: 30 },
    { key: 'references', label: 'References', type: 'markdown', required: false, placeholder: '- link 1\n- link 2' },
    { key: 'next_steps', label: 'Next steps', type: 'markdown', required: false },
  ],
};

const KB: Template = {
  type: 'kb',
  version: 1,
  description: 'Knowledge-base entry — problem + solution. Ưu tiên style: dev B paste error → tìm ra ngay.',
  fields: [
    { key: 'problem', label: 'Problem / symptoms', type: 'markdown', required: true, minLength: 15, placeholder: 'Error message, log line, symptom that a future dev will paste when searching.' },
    { key: 'solution', label: 'Solution', type: 'markdown', required: true, minLength: 30, placeholder: 'Step-by-step fix. Include commands + code snippets.' },
    { key: 'related', label: 'Related resources', type: 'markdown', required: false, placeholder: '- link tới runbook\n- link tới artifact khác' },
  ],
};

// Postmortem template — V6: 4 required fields, no minLength, all optional remain free-form.
// Thứ tự: required fields trước, optional sau.
const POSTMORTEM: Template = {
  type: 'postmortem',
  version: 1,
  description: 'Ops post-mortem template — 4 required fields, các fields còn lại optional để không cản ops 2am.',
  fields: [
    // Required (V6 — chỉ 4)
    { key: 'summary', label: 'Summary', type: 'markdown', required: true, placeholder: 'What happened — 2-3 câu mô tả sự cố.' },
    { key: 'timeline', label: 'Timeline', type: 'markdown', required: true, placeholder: '- HH:MM - Event\n- HH:MM - Root cause identified\n- HH:MM - Mitigated' },
    { key: 'root_cause', label: 'Root Cause', type: 'markdown', required: true, placeholder: 'Nguyên nhân gốc rễ. 5-whys nếu cần.' },
    { key: 'action_items', label: 'Action Items', type: 'markdown', required: true, placeholder: '- [ ] Fix X (owner: @user, due: YYYY-MM-DD)\n- [ ] Add alert Y' },
    // Optional
    { key: 'severity', label: 'Severity', type: 'text', required: false, placeholder: 'SEV1 / SEV2 / SEV3' },
    { key: 'incident_id', label: 'Incident ID', type: 'text', required: false, placeholder: 'INC-20260717-1' },
    { key: 'date_occurred', label: 'Date Occurred', type: 'text', required: false, placeholder: '2026-07-17' },
    { key: 'duration_minutes', label: 'Duration (minutes)', type: 'text', required: false, placeholder: '45' },
    { key: 'blast_radius', label: 'Blast Radius', type: 'markdown', required: false, placeholder: 'Services + user impact.' },
    { key: 'remediation', label: 'Remediation', type: 'markdown', required: false, placeholder: 'Fix cụ thể đã làm.' },
    { key: 'detection_gap', label: 'Detection Gap', type: 'markdown', required: false, placeholder: 'Tại sao không phát hiện sớm hơn?' },
    { key: 'lessons_learned', label: 'Lessons Learned', type: 'markdown', required: false },
    // raw_logs — type=logs, compile to ```log fence (V7)
    { key: 'raw_logs', label: 'Raw Logs', type: 'logs', required: false, description: 'Log liên quan đến sự cố. Sẽ render trong ```log fence block.' },
  ],
};

// Runbook template — 6 required, no minLength. service field maps to artifacts.service column.
const RUNBOOK: Template = {
  type: 'runbook',
  version: 1,
  description: 'Operational runbook — symptoms → verify → mitigate → escalate. Gọi load_runbook khi paged.',
  fields: [
    // Required
    { key: 'service', label: 'Service', type: 'text', required: true, placeholder: 'postgres | redis | nginx | backend | portal | minio', description: 'Tên service liên quan. Lưu vào cột artifacts.service để boost search.' },
    { key: 'symptoms', label: 'Symptoms', type: 'markdown', required: true, placeholder: 'Alert signals + observable symptoms:\n- CPU > 90%\n- Error rate spikes' },
    { key: 'verify_command', label: 'Verify Commands', type: 'markdown', required: true, placeholder: '```bash\npsql -c "SELECT pg_database_size(current_database());"\n```' },
    { key: 'mitigation_steps', label: 'Mitigation Steps', type: 'markdown', required: true, placeholder: '1. Step 1\n2. Step 2\n3. Step 3' },
    { key: 'verification_after', label: 'Verification After Mitigation', type: 'markdown', required: true, placeholder: 'Commands + expected output xác nhận đã fix.' },
    { key: 'escalation_path', label: 'Escalation Path', type: 'markdown', required: true, placeholder: '1. On-call SRE\n2. Team Lead\n3. CTO' },
    // Optional
    { key: 'related_alerts', label: 'Related Alerts', type: 'text', required: false, placeholder: 'DiskFull,PostgresOOM,RedisHighMemory (comma-separated alertname)' },
    { key: 'severity_impact', label: 'Severity Impact', type: 'markdown', required: false, placeholder: 'SEV1: full outage\nSEV2: degraded performance' },
  ],
};

const REGISTRY: Record<ArtifactType, Template> = {
  report: REPORT,
  research: RESEARCH,
  kb: KB,
  postmortem: POSTMORTEM,
  runbook: RUNBOOK,
};

export function getTemplate(type: ArtifactType): Template {
  return REGISTRY[type];
}

export function listTemplates(): Template[] {
  return Object.values(REGISTRY);
}
