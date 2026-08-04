'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
// Icons removed (icon budget: 0 outside sidebar-nav).
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { listSpaces, Space } from '../lib/api/spaces';
import { listTemplates, Template } from '../lib/api/templates';

// ArtifactStatus options available for filtering.
const STATUS_OPTIONS = ['draft', 'pending', 'published', 'archived'] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];

// Debounce helper — delays calling fn until after delay ms have passed
// since the last call. Used for text inputs to reduce URL churn.
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export interface FilterState {
  space: string;
  templateKey: string;
  tags: string;   // comma-separated raw input
  status: string;
  author: string; // 'me' | '' | numeric string
  dateFrom: string;
  dateTo: string;
}

function countActive(f: FilterState): number {
  return [f.space, f.templateKey, f.tags, f.status, f.author, f.dateFrom, f.dateTo]
    .filter(Boolean).length;
}

// Reads initial filter state from URL search params.
function fromSearchParams(params: URLSearchParams): FilterState {
  return {
    space: params.get('space') ?? '',
    templateKey: params.get('template_key') ?? '',
    tags: params.get('tags') ?? '',
    status: params.get('status') ?? '',
    author: params.get('author') ?? '',
    dateFrom: params.get('date_from') ?? '',
    dateTo: params.get('date_to') ?? '',
  };
}

interface Props {
  /** Called when filter state changes — parent uses this to fetch list. */
  onChange: (f: FilterState) => void;
}

// Filter panel — always expanded, syncs state to URL params (deep-linkable).
// Text inputs debounced 300ms.
export function ArtifactFilterPanel({ onChange }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const tErrors = useTranslations('errors');
  const t = useTranslations('filters');

  const [local, setLocal] = useState<FilterState>(() => fromSearchParams(searchParams));

  // Text inputs deferred to avoid URL spam on every keystroke.
  const debouncedTags = useDebounce(local.tags, 300);
  const debouncedAuthor = useDebounce(local.author, 300);
  const debouncedDateFrom = useDebounce(local.dateFrom, 300);
  const debouncedDateTo = useDebounce(local.dateTo, 300);

  // Track if this is the initial mount to avoid double-fire.
  const mounted = useRef(false);

  useEffect(() => {
    // Surface fetch failures so an empty filter panel isn't confused with
    // "no spaces / templates exist".
    listSpaces().then(setSpaces).catch(() => toast.error(tErrors('loadSpacesFailed')));
    listTemplates().then(setTemplates).catch(() => toast.error(tErrors('loadTemplatesFailed')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync space from URL param on change — enables sidebar SpaceSwitcher to
  // filter this list without remounting. Only sync space (other filters own
  // their local state to avoid clobbering debounced typing).
  const urlSpace = searchParams.get('space') ?? '';
  useEffect(() => {
    if (urlSpace !== local.space) {
      setLocal((prev) => ({ ...prev, space: urlSpace }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSpace]);

  // Build effective filter (debounced text fields merged with instant selects).
  const effective: FilterState = {
    ...local,
    tags: debouncedTags,
    author: debouncedAuthor,
    dateFrom: debouncedDateFrom,
    dateTo: debouncedDateTo,
  };

  // Sync effective filter → URL params and notify parent.
  const prevRef = useRef<string>('');
  useEffect(() => {
    const key = JSON.stringify(effective);
    if (key === prevRef.current) return;
    prevRef.current = key;

    const params = new URLSearchParams();
    if (effective.space) params.set('space', effective.space);
    if (effective.templateKey) params.set('template_key', effective.templateKey);
    if (effective.tags) params.set('tags', effective.tags);
    if (effective.status) params.set('status', effective.status);
    if (effective.author) params.set('author', effective.author);
    if (effective.dateFrom) params.set('date_from', effective.dateFrom);
    if (effective.dateTo) params.set('date_to', effective.dateTo);

    const qs = params.toString();
    if (mounted.current) {
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    }
    mounted.current = true;
    onChange(effective);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(effective)]);

  const set = useCallback(<K extends keyof FilterState>(k: K, v: FilterState[K]) => {
    setLocal((prev) => ({ ...prev, [k]: v }));
  }, []);

  function reset() {
    const empty: FilterState = { space: '', templateKey: '', tags: '', status: '', author: '', dateFrom: '', dateTo: '' };
    setLocal(empty);
  }

  const activeCount = countActive(effective);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-3 text-sm font-medium">
        {t('title')}
        {activeCount > 0 && (
          <Badge variant="secondary" className="tabular-nums">{activeCount}</Badge>
        )}
      </div>
      <Separator />
      <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Space */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('space')}</span>
          <select
            value={local.space}
            onChange={(e) => set('space', e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30"
          >
            <option value="">{t('allSpaces')}</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.slug}>{s.name}</option>
            ))}
          </select>
        </label>

        {/* Template */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('template')}</span>
          <select
            value={local.templateKey}
            onChange={(e) => set('templateKey', e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30"
          >
            <option value="">{t('allTemplates')}</option>
            {templates.map((tpl) => (
              <option key={tpl.key} value={tpl.key}>{tpl.label}</option>
            ))}
          </select>
        </label>

        {/* Status */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('status')}</span>
          <select
            value={local.status}
            onChange={(e) => set('status', e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30"
          >
            <option value="">{t('allStatuses')}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        {/* Tags — free text, comma-separated */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('tagsField')}</span>
          <Input
            value={local.tags}
            onChange={(e) => set('tags', e.target.value)}
            placeholder={t('tagsPlaceholder')}
          />
        </label>

        {/* Author */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('author')}</span>
          <Input
            value={local.author}
            onChange={(e) => set('author', e.target.value)}
            placeholder={t('authorPlaceholder')}
          />
        </label>

        {/* Date range */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('dateRange')}</span>
          <div className="flex gap-2">
            <Input
              type="date"
              value={local.dateFrom}
              onChange={(e) => set('dateFrom', e.target.value)}
              className="flex-1"
              aria-label={t('fromDate')}
            />
            <Input
              type="date"
              value={local.dateTo}
              onChange={(e) => set('dateTo', e.target.value)}
              className="flex-1"
              aria-label={t('toDate')}
            />
          </div>
        </div>
      </div>

      {activeCount > 0 && (
        <div className="flex justify-end border-t border-border px-4 py-2">
          <Button variant="ghost" size="sm" onClick={reset}>
            {t('resetFilters')}
          </Button>
        </div>
      )}
    </div>
  );
}
