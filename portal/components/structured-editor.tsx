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
      <p className="rounded border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
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
      'w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground',
  };
  return (
    <div>
      <label className="mb-1 flex items-center gap-2 text-sm font-medium">
        {field.label}
        {field.required && <span className="text-xs text-destructive">*</span>}
        {field.minLength && <span className="text-xs text-muted-foreground">min {field.minLength} chars</span>}
      </label>
      {field.type === 'markdown' ? (
        <textarea {...common} rows={6} className={common.className + ' font-mono'} />
      ) : (
        <input {...common} type="text" />
      )}
      {field.description && <p className="mt-1 text-xs text-muted-foreground">{field.description}</p>}
    </div>
  );
}
