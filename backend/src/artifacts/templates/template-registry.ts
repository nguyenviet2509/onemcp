import { ArtifactType } from '../artifact-type.enum';

// Template = danh sách sections bắt buộc/optional per artifact type.
// Structured JSONB lưu {key: content} theo template. Body auto-compile.
// Schema đơn giản (không dùng full JSON Schema) — YAGNI cho pilot.

export interface TemplateField {
  key: string; // Snake case, unique trong template.
  label: string; // UI label.
  type: 'text' | 'markdown';
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

const REGISTRY: Record<ArtifactType, Template> = {
  report: REPORT,
  research: RESEARCH,
  kb: KB,
};

export function getTemplate(type: ArtifactType): Template {
  return REGISTRY[type];
}

export function listTemplates(): Template[] {
  return Object.values(REGISTRY);
}
