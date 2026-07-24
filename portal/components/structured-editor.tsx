'use client';

import { Template, TemplateField } from '../lib/api/templates';

interface Props {
  template: Template;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

// Dynamic form từ template.fields. Text = <input>, markdown = <textarea>.
// Không tự validate ở FE — backend enforce; FE chỉ hint via required + minLength attr.
export function StructuredEditor({ template, values, onChange }: Props) {
  return (
    <div className="space-y-4">
      <p className="rounded bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-950 dark:text-blue-100">
        Template <b>{template.label}</b> v{template.version}: {template.description}
      </p>
      {template.fields.map((f) => (
        <FieldEditor key={f.key} field={f} value={values[f.key] ?? ''} onChange={(v) => onChange(f.key, v)} />
      ))}
    </div>
  );
}

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: string;
  onChange: (v: string) => void;
}) {
  const common = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    required: field.required,
    maxLength: field.maxLength,
    placeholder: field.placeholder,
    className:
      'w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900',
  };
  return (
    <div>
      <label className="mb-1 flex items-center gap-2 text-sm font-medium">
        {field.label}
        {field.required && <span className="text-xs text-red-600">*</span>}
        {field.minLength && <span className="text-xs text-slate-400">min {field.minLength} chars</span>}
      </label>
      {field.type === 'markdown' ? (
        <textarea {...common} rows={6} className={common.className + ' font-mono'} />
      ) : (
        <input {...common} type="text" />
      )}
      {field.description && <p className="mt-1 text-xs text-slate-500">{field.description}</p>}
    </div>
  );
}
