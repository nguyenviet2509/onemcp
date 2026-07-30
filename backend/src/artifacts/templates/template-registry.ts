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

// V2: Session-summary oriented fields for wrapup hook (plan 260730-1043-openwebui-wrapup-hook).
// Replaced V1 postmortem-style fields (summary/incident_timeline/root_cause/remediation).
// context/work_done/outcome match the extractor prompts in Phase 2.
const REPORT: Template = {
  type: 'report',
  version: 2,
  description: 'Session outcome report — tại sao làm, làm gì, kết quả cụ thể.',
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
};

// V2: Hypothesis-driven research fields for wrapup hook.
// Replaced V1 methodology-oriented fields (methodology/findings/references/next_steps).
// question/hypothesis/findings/references/conclusion match the extractor prompts in Phase 2.
const RESEARCH: Template = {
  type: 'research',
  version: 2,
  description: 'Research note — câu hỏi, giả thuyết, phát hiện, kết luận.',
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
