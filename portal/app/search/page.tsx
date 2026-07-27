'use client';

import { Suspense, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// SearchIcon, BookmarkIcon removed (icon budget: 0 outside sidebar-nav).
import { toast } from 'sonner';
import { PageShell } from '@/components/page-shell';
import { EmptyState } from '@/components/empty-state';
import { ArtifactFilterPanel, FilterState } from '@/components/artifact-filter-panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { search, SearchHit } from '@/lib/api/search';
import { createSaved } from '@/lib/api/saved-searches';
import { ApiError } from '@/lib/api-client';

// Matches SearchParams.mode in lib/api/search.ts
type SearchMode = 'hybrid' | 'fts' | 'vector';

// Strip non-<b>/<mark> tags for safe snippet rendering.
function sanitizeSnippet(s: string): string {
  return s.replace(/<(?!\/?(?:b|i|mark)\b)[^>]*>/gi, '');
}

// Highlight query terms in plain text with <mark>.
function highlightTerms(text: string, q: string): string {
  if (!q.trim()) return text;
  const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const rawMode = searchParams.get('mode');
  const [mode, setMode] = useState<SearchMode>(
    (rawMode === 'fts' || rawMode === 'vector') ? rawMode : 'hybrid'
  );
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [filters, setFilters] = useState<FilterState | null>(null);

  // Save-search dialog
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);

  const runSearch = useCallback(async (query: string, currentMode: SearchMode, currentFilters: FilterState | null) => {
    if (query.trim().length < 2) return;
    setBusy(true);
    setError(null);
    setSubmitted(true);
    try {
      const tags = currentFilters?.tags
        ? currentFilters.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : undefined;
      const r = await search({
        q: query.trim(),
        mode: currentMode,
        space: currentFilters?.space || undefined,
        templateKey: currentFilters?.templateKey || undefined,
        tags,
        dept: currentFilters?.['dept' as keyof FilterState] || undefined,
      });
      setHits(r);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.set('q', q);
    params.set('mode', mode);
    router.replace(`?${params.toString()}`, { scroll: false });
    runSearch(q, mode, filters);
  }

  function handleModeChange(newMode: string) {
    const m = newMode as SearchMode;
    setMode(m);
    if (submitted && q.trim().length >= 2) {
      runSearch(q, m, filters);
    }
  }

  function handleFilterChange(f: FilterState) {
    setFilters(f);
  }

  async function handleSave() {
    if (!saveName.trim() || !q.trim()) return;
    setSaving(true);
    try {
      await createSaved({
        name: saveName.trim(),
        query: q.trim(),
        filters: {
          mode,
          space: filters?.space || undefined,
          templateKey: filters?.templateKey || undefined,
          tags: filters?.tags
            ? filters.tags.split(',').map((t) => t.trim()).filter(Boolean)
            : undefined,
        },
      });
      toast.success('Search saved');
      setSaveOpen(false);
      setSaveName('');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to save search');
    } finally {
      setSaving(false);
    }
  }

  const saveAction = (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={!submitted || hits.length === 0}
        onClick={() => setSaveOpen(true)}
      >
        Save search
      </Button>
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save this search</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <Label htmlFor="save-name">Name</Label>
          <Input
            id="save-name"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="e.g. Payment webhook issues"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving || !saveName.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );

  return (
    <PageShell title="Search" actions={saveAction}>
      {/* Mode tabs + search bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={mode} onValueChange={handleModeChange} className="w-auto">
          <TabsList>
            <TabsTrigger value="hybrid">Hybrid</TabsTrigger>
            <TabsTrigger value="fts">Full-text</TabsTrigger>
            <TabsTrigger value="vector">Vector (semantic)</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search artifacts, skills…"
          className="flex-1"
          autoFocus
        />
        <Button type="submit" disabled={busy || q.trim().length < 2}>
          {busy ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {/* Filter panel */}
      <div className="mb-6">
        <ArtifactFilterPanel onChange={handleFilterChange} />
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading skeletons */}
      {busy && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {submitted && !busy && hits.length === 0 && !error && (
        <EmptyState
          title="No results found"
          description="Try different search terms, switch modes, or adjust filters."
        />
      )}

      {/* Results */}
      {!busy && hits.length > 0 && (
        <ul className="space-y-3">
          {hits.map((h) => {
            const snippetHtml = h.snippet.includes('<b>') || h.snippet.includes('<mark>')
              ? sanitizeSnippet(h.snippet)
              : highlightTerms(h.snippet, q);
            const itemLink = h.kind === 'skill'
              ? `/skills/${encodeURIComponent(h.name)}`
              : `/artifacts/${h.id}`;
            const sourceMeta = h.meta?.source as string | undefined;
            const rrfScore = h.meta?.rrfScore as number | undefined;

            return (
              <li
                key={`${h.kind}-${h.id}`}
                className="rounded-lg border border-border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">{h.kind}</Badge>
                  {sourceMeta && (
                    <Badge variant="outline" className="font-mono text-xs">{sourceMeta}</Badge>
                  )}
                  <a href={itemLink} className="text-base font-semibold text-primary hover:underline">
                    {h.name}
                  </a>
                  {rrfScore !== undefined && (
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      rrf {rrfScore.toFixed(4)}
                    </span>
                  )}
                </div>
                <p
                  className="mt-2 text-sm text-muted-foreground [&_b]:bg-primary/10 [&_b]:font-semibold [&_mark]:bg-primary/10 [&_mark]:text-foreground"
                  dangerouslySetInnerHTML={{ __html: snippetHtml }}
                />
                {h.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {h.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="font-mono text-xs">{t}</Badge>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-6 py-8"><Skeleton className="h-48 w-full" /></div>}>
      <SearchPageInner />
    </Suspense>
  );
}
