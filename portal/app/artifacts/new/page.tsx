'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { TemplatePicker } from '../../../components/template-picker';
import { MarkdownEditor, MarkdownEditorDark } from '../../../components/markdown-editor';
import { PageShell } from '../../../components/page-shell';
import { Button, buttonVariants } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Separator } from '../../../components/ui/separator';
import { ApiError } from '../../../lib/api-client';
import { submitArtifact, ArtifactType } from '../../../lib/api/artifacts';
import { getTemplate, Template, TemplateField } from '../../../lib/api/templates';

// Draft persisted to localStorage so the user doesn't lose work on refresh.
const DRAFT_KEY = 'onemcp:new-artifact:draft';

interface DraftState {
  templateKey: string | null;
  title: string;
  slug: string;
  tags: string;
  fields: Record<string, string>;
  body: string;
}

const EMPTY_DRAFT: DraftState = {
  templateKey: null,
  title: '',
  slug: '',
  tags: '',
  fields: {},
  body: '',
};

function loadDraft(): DraftState {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY_DRAFT, ...JSON.parse(raw) } : EMPTY_DRAFT;
  } catch {
    return EMPTY_DRAFT;
  }
}

function saveDraft(d: DraftState) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // Storage quota exceeded — ignore silently.
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

// Auto-generates a slug from a title string.
function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

// Renders a single template field as an appropriate input element.
function TemplateFieldInput({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === 'select' && field.options) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30"
      >
        <option value="">Select…</option>
        {field.options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }
  if (field.type === 'textarea' || field.type === 'logs') {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        placeholder={field.placeholder}
        rows={4}
        maxLength={field.maxLength}
        minLength={field.minLength}
        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30"
      />
    );
  }
  // Default: text / markdown field treated as single-line text input at form step.
  // Markdown fields that need rich editing belong in Step 3 body editor.
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={field.required}
      placeholder={field.placeholder}
      maxLength={field.maxLength}
      minLength={field.minLength}
    />
  );
}

// Step indicator row.
function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const t = useTranslations('pages.artifactsNew.steps');
  const steps = [t('template'), t('details'), t('body')];
  return (
    <div className="mb-6 flex items-center gap-2 text-sm">
      {steps.map((label, i) => {
        const num = i + 1;
        const active = num === step;
        const done = num < step;
        return (
          <span key={label} className="flex items-center gap-2">
            {i > 0 && <Separator orientation="horizontal" className="w-6" />}
            <span
              className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : done
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {num}
            </span>
            <span
              className={active ? 'font-medium text-foreground' : 'text-muted-foreground'}
            >
              {label}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default function NewArtifactPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [template, setTemplate] = useState<Template | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('pages.artifactsNew');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');

  // Hydrate draft from localStorage on client mount only.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const saved = loadDraft();
    setDraft(saved);
  }, []);

  // Persist draft whenever it changes.
  useEffect(() => {
    if (!hydrated.current) return;
    saveDraft(draft);
  }, [draft]);

  // Fetch template details when templateKey changes.
  useEffect(() => {
    if (!draft.templateKey) {
      setTemplate(null);
      return;
    }
    getTemplate(draft.templateKey)
      .then(setTemplate)
      .catch(() => setTemplate(null));
  }, [draft.templateKey]);

  function updateDraft(partial: Partial<DraftState>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function handleTitleChange(title: string) {
    updateDraft({ title, slug: toSlug(title) });
  }

  function handleFieldChange(key: string, value: string) {
    updateDraft({ fields: { ...draft.fields, [key]: value } });
  }

  async function handleSubmit() {
    if (!template) return;
    setBusy(true);
    setError(null);
    try {
      const result = await submitArtifact({
        type: (template.key.split('-')[0] as ArtifactType) ?? 'kb',
        title: draft.title.trim(),
        slug: draft.slug.trim().toLowerCase(),
        body: draft.body,
        structured: draft.fields,
        tags: draft.tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      clearDraft();
      toast.success(t('submittingToast'));
      router.push(`/artifacts/${result.artifact.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
      setBusy(false);
    }
  }

  const canGoToStep2 = !!draft.templateKey;
  const canGoToStep3 = draft.title.trim().length > 0 && draft.slug.trim().length > 0;

  return (
    <PageShell
      title={t('title')}
      breadcrumb={[
        { label: tNav('artifacts'), href: '/artifacts' },
        { label: t('title') },
      ]}
    >
      <StepIndicator step={step} />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Step 1: Template picker ── */}
      {step === 1 && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {t('chooseTemplate')}
          </p>
          <TemplatePicker
            selected={draft.templateKey}
            onSelect={(key) => updateDraft({ templateKey: key, fields: {} })}
          />
          <div className="flex items-center justify-between pt-2">
            <Link href="/artifacts" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              {tCommon('cancel')}
            </Link>
            <Button
              size="sm"
              disabled={!canGoToStep2}
              onClick={() => setStep(2)}
            >
              {tCommon('continue')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Metadata form ── */}
      {step === 2 && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {t('fillFields')}
          </p>

          <div className="space-y-4 rounded-lg border border-border bg-card p-5">
            {/* Title */}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t('titleField')} <span className="text-destructive">*</span></span>
              <Input
                required
                value={draft.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder={t('titlePlaceholder')}
                maxLength={255}
              />
            </label>

            {/* Slug — auto-generated but editable */}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t('slugField')} <span className="text-destructive">*</span></span>
              <Input
                required
                value={draft.slug}
                onChange={(e) => updateDraft({ slug: e.target.value })}
                className="font-mono"
                placeholder={t('slugPlaceholder')}
                pattern="[a-z0-9][a-z0-9-]*"
                maxLength={160}
              />
              <span className="text-xs text-muted-foreground">{t('slugHint')}</span>
            </label>

            {/* Tags */}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t('tagsField')}</span>
              <Input
                value={draft.tags}
                onChange={(e) => updateDraft({ tags: e.target.value })}
                placeholder={t('tagsPlaceholder')}
              />
            </label>

            {/* Template-specific fields */}
            {template && template.fields.filter((f) => f.type !== 'markdown').length > 0 && (
              <>
                <Separator />
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {template.label} fields
                </p>
                {template.fields
                  .filter((f) => f.type !== 'markdown')
                  .map((f) => (
                    <div key={f.key} className="flex flex-col gap-1">
                      <label className="text-sm font-medium">
                        {f.label}
                        {f.required && <span className="ml-1 text-destructive">*</span>}
                      </label>
                      {f.description && (
                        <p className="text-xs text-muted-foreground">{f.description}</p>
                      )}
                      <TemplateFieldInput
                        field={f}
                        value={draft.fields[f.key] ?? ''}
                        onChange={(v) => handleFieldChange(f.key, v)}
                      />
                    </div>
                  ))}
              </>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" onClick={() => setStep(1)}>
              {tCommon('back')}
            </Button>
            <Button size="sm" disabled={!canGoToStep3} onClick={() => setStep(3)}>
              {tCommon('continue')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Markdown body editor ── */}
      {step === 3 && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {t('writeBody')}
          </p>

          {/* Render both light + dark editors; CSS hides the inactive one */}
          <MarkdownEditor value={draft.body} onChange={(v) => updateDraft({ body: v })} minHeight={380} />
          <MarkdownEditorDark value={draft.body} onChange={(v) => updateDraft({ body: v })} minHeight={380} />

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" onClick={() => setStep(2)}>
              {tCommon('back')}
            </Button>
            <Button size="sm" disabled={busy} onClick={handleSubmit}>
              {busy ? tCommon('submitting') : t('submitForReview')}
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
