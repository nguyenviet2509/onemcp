import { apiFetch } from '../api-client';

// Template — artifact creation templates scoped to dept/space (Phase 1 backend).
export interface TemplateField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'markdown' | 'select' | 'logs';
  required: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  description?: string;
  options?: string[];  // for 'select' type
}

// FE-normalized shape — consumers always see this regardless of backend version.
export interface Template {
  key: string;           // unique slug, e.g. "postmortem-v2"
  label: string;         // display name
  description: string;
  deptSlug: string | null;  // null = global template
  isActive: boolean;
  version: number;
  fields: TemplateField[];
  createdAt: string;
  updatedAt: string;
}

// Raw backend shape — may vary between schema versions.
interface RawSchemaV2 {
  fields: Array<{
    key: string;
    label?: string;
    type?: string;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    placeholder?: string;
    description?: string;
    options?: string[];
  }>;
  version?: number;
}

// Old key-value format used by faq/sop/ticket_playbook templates.
interface RawSchemaV1 {
  required?: string[];
  optional?: string[];
  field_labels?: Record<string, string>;
}

interface RawTemplate {
  key: string;
  label: string;
  description?: string;
  schema: RawSchemaV2 | RawSchemaV1 | null;
  uiHints?: Record<string, unknown>;
  departmentScope?: string[];
  active?: boolean;
  isActive?: boolean;       // some versions send this directly
  deptSlug?: string | null; // some versions send this directly
  version?: number;
  fields?: TemplateField[]; // some versions hoist fields to root
  createdAt: string;
  updatedAt: string;
}

// Derive TemplateField[] from old required/optional/field_labels schema.
function deriveFieldsFromV1(schema: RawSchemaV1): TemplateField[] {
  const labels = schema.field_labels ?? {};
  const required = schema.required ?? [];
  const optional = schema.optional ?? [];
  return [
    ...required.map((key) => ({
      key,
      label: labels[key] ?? key,
      type: 'markdown' as const,
      required: true,
    })),
    ...optional.map((key) => ({
      key,
      label: labels[key] ?? key,
      type: 'markdown' as const,
      required: false,
    })),
  ];
}

// Coerce raw schema.fields entries to typed TemplateField[].
function coerceV2Fields(raw: RawSchemaV2['fields']): TemplateField[] {
  const validTypes = new Set(['text', 'textarea', 'markdown', 'select', 'logs']);
  return raw.map((f) => ({
    key: f.key,
    label: f.label ?? f.key,
    type: (validTypes.has(f.type ?? '') ? f.type : 'markdown') as TemplateField['type'],
    required: f.required ?? false,
    ...(f.minLength !== undefined && { minLength: f.minLength }),
    ...(f.maxLength !== undefined && { maxLength: f.maxLength }),
    ...(f.placeholder !== undefined && { placeholder: f.placeholder }),
    ...(f.description !== undefined && { description: f.description }),
    ...(f.options !== undefined && { options: f.options }),
  }));
}

// Normalize raw backend response → FE Template interface.
export function normalizeTemplate(raw: RawTemplate): Template {
  let fields: TemplateField[];
  let version = raw.version ?? 1;

  if (Array.isArray(raw.fields) && raw.fields.length > 0) {
    // Fields hoisted to root (old FE-generated payloads).
    fields = raw.fields;
  } else if (raw.schema && 'fields' in raw.schema && Array.isArray(raw.schema.fields)) {
    // Schema v2: { fields: [...], version: N }
    const s = raw.schema as RawSchemaV2;
    fields = coerceV2Fields(s.fields);
    version = s.version ?? version;
  } else if (raw.schema && ('required' in raw.schema || 'optional' in raw.schema)) {
    // Schema v1 key-value format.
    fields = deriveFieldsFromV1(raw.schema as RawSchemaV1);
  } else {
    fields = [];
  }

  // deptSlug: prefer direct field, else first element of departmentScope array.
  const deptSlug =
    raw.deptSlug !== undefined
      ? raw.deptSlug
      : (raw.departmentScope?.[0] ?? null);

  // isActive: prefer direct field, else backend 'active'.
  const isActive =
    raw.isActive !== undefined ? raw.isActive : (raw.active ?? true);

  return {
    key: raw.key,
    label: raw.label,
    description: raw.description ?? '',
    deptSlug,
    isActive,
    version,
    fields,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export interface CreateTemplatePayload {
  key: string;
  label: string;
  description?: string;
  deptSlug?: string;
  fields: TemplateField[];
}

export interface UpdateTemplatePayload {
  label?: string;
  description?: string;
  isActive?: boolean;
  fields?: TemplateField[];
}

export function listTemplates(deptSlug?: string) {
  const qs = deptSlug ? `?dept=${encodeURIComponent(deptSlug)}` : '';
  return apiFetch<RawTemplate[]>(`/templates${qs}`).then((list) =>
    list.map(normalizeTemplate),
  );
}

export function getTemplate(key: string) {
  return apiFetch<RawTemplate>(`/templates/${encodeURIComponent(key)}`).then(
    normalizeTemplate,
  );
}

// Admin CRUD — requires CIDR-gated role.
export function createTemplate(payload: CreateTemplatePayload) {
  return apiFetch<RawTemplate>('/templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then(normalizeTemplate);
}

export function updateTemplate(key: string, payload: UpdateTemplatePayload) {
  return apiFetch<RawTemplate>(`/templates/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }).then(normalizeTemplate);
}

export function deleteTemplate(key: string) {
  return apiFetch<void>(`/templates/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
}
